const fs = require('fs');
const path = require('path');
const { getDMMF } = require('@prisma/internals');

/* =========================
 * PATHS (EDIT IF NEEDED)
 * ========================= */
const ROOT_DIR = path.resolve(__dirname, '..');

const MODULES_DIR = path.join(ROOT_DIR, 'src/app/modules');
const ROUTES_INDEX_PATH = path.join(ROOT_DIR, 'src/app/routes/index.ts');
const PRISMA_DIR = path.join(ROOT_DIR, 'prisma');

/* =========================
 * SMALL UTILS
 * ========================= */
const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

const pluralize = str => `${str}s`;

const isObjectIdField = (schemaText, modelName, fieldName) => {
  const modelBlockRe = new RegExp(
    `model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`,
    'm',
  );
  const match = schemaText.match(modelBlockRe);
  if (!match) return false;

  const block = match[1];
  const fieldLineRe = new RegExp(
    `^\\s*${fieldName}\\s+\\w+[\\?\\[\\]\\s\\w@()".:]*@db\\.ObjectId`,
    'm',
  );
  return fieldLineRe.test(block);
};

const toObjectIdZod = () =>
  `z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId')`;

const scalarToZod = ({ type, isList }) => {
  let base;
  switch (type) {
    case 'String':
      base = 'z.string()';
      break;
    case 'Int':
      base = 'z.number().int()';
      break;
    case 'Float':
      base = 'z.number()';
      break;
    case 'Boolean':
      base = 'z.boolean()';
      break;
    case 'DateTime':
      // Accept ISO date strings and convert to Date
      base = 'z.coerce.date()';
      break;
    default:
      base = null;
  }
  if (!base) return null;
  return isList ? `z.array(${base})` : base;
};

const enumToZod = ({ enumName, isList }) => {
  // uses Prisma enum runtime from @prisma/client
  const base = `z.nativeEnum(Prisma.${enumName})`;
  return isList ? `z.array(${base})` : base;
};

const shouldSkipField = f => {
  if (['id', 'createdAt', 'updatedAt'].includes(f.name)) return true;
  if (f.kind === 'object') return true;
  return false;
};

const readPrismaSchema = () => {
  if (!fs.existsSync(PRISMA_DIR)) {
    throw new Error(`Prisma directory not found: ${PRISMA_DIR}`);
  }

  const files = fs.readdirSync(PRISMA_DIR).filter(f => f.endsWith('.prisma'));

  if (!files.length) {
    throw new Error('No .prisma files found');
  }

  return files
    .map(file => fs.readFileSync(path.join(PRISMA_DIR, file), 'utf8'))
    .join('\n');
};

/* =========================
 * PRISMA -> ZOD GENERATION
 * ========================= */
const getModelFromDmmf = async modelName => {
  const schemaText = readPrismaSchema();
  const dmmf = await getDMMF({ datamodel: schemaText });

  const model = dmmf.datamodel.models.find(
    m => m.name.toLowerCase() === modelName.toLowerCase(),
  );

  if (!model) {
    throw new Error(`Prisma model '${modelName}' not found in schema.prisma`);
  }

  return { model, schemaText };
};

const buildZodShape = ({ model, schemaText }, mode /* 'create'|'update' */) => {
  const lines = [];

  for (const f of model.fields) {
    if (shouldSkipField(f)) continue;

    const isList = !!f.isList;

    // create: required if isRequired and has no default
    // update: always optional
    const requiredInCreate = !!f.isRequired && !f.hasDefaultValue;
    const optional = mode === 'update' ? true : !requiredInCreate;

    let zodExpr = null;

    // Mongo ObjectId validation for String @db.ObjectId
    if (
      f.kind === 'scalar' &&
      f.type === 'String' &&
      isObjectIdField(schemaText, model.name, f.name)
    ) {
      zodExpr = isList ? `z.array(${toObjectIdZod()})` : toObjectIdZod();
    } else if (f.kind === 'enum') {
      zodExpr = enumToZod({ enumName: f.type, isList });
    } else if (f.kind === 'scalar') {
      zodExpr = scalarToZod({ type: f.type, isList });
    }

    // If unsupported, skip (or you can make it z.any())
    if (!zodExpr) continue;

    if (optional) zodExpr = `${zodExpr}.optional()`;

    lines.push(`  ${f.name}: ${zodExpr},`);
  }

  return lines.join('\n');
};

const generateValidationFileContent = async moduleName => {
  const { model, schemaText } = await getModelFromDmmf(moduleName);

  const createShape = buildZodShape({ model, schemaText }, 'create');
  const updateShape = buildZodShape({ model, schemaText }, 'update');

  return `
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const createSchema = z.object({
${createShape || '  // no scalar fields to validate'}
});

const updateSchema = z.object({
${updateShape || '  // no scalar fields to validate'}
});

export const ${moduleName}Validation = {
  createSchema,
  updateSchema,
};
`.trim();
};

/* =========================
 * TEMPLATES
 * ========================= */
const templates = async moduleName => {
  const Capitalized = capitalize(moduleName);

  return {
    controller: `
import httpStatus from 'http-status';
import { ${moduleName}Service } from './${moduleName}.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../utils/pickValidFields';

// create ${Capitalized}
const create${Capitalized} = catchAsync(async (req: Request, res: Response) => {
  const data = req.body;
  const result = await ${moduleName}Service.create${Capitalized}(data);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: '${Capitalized} created successfully',
    data: result,
  });
});

// get all ${Capitalized}
const ${moduleName}FilterableFields = [
  'searchTerm',
  'id',
  'createdAt',
];
const get${Capitalized}List = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, ${moduleName}FilterableFields);
  const result = await ${moduleName}Service.get${Capitalized}List(options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: '${Capitalized} list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// get ${Capitalized} by id
const get${Capitalized}ById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ${moduleName}Service.get${Capitalized}ById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: '${Capitalized} details retrieved successfully',
    data: result,
  });
});

// update ${Capitalized}
const update${Capitalized} = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const result = await ${moduleName}Service.update${Capitalized}(id, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: '${Capitalized} updated successfully',
    data: result,
  });
});

// delete ${Capitalized}
const delete${Capitalized} = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ${moduleName}Service.delete${Capitalized}(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: '${Capitalized} deleted successfully',
    data: result,
  });
});

export const ${moduleName}Controller = {
  create${Capitalized},
  get${Capitalized}List,
  get${Capitalized}ById,
  update${Capitalized},
  delete${Capitalized},
};
`.trim(),

    service: `
import httpStatus from "http-status";
import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma";
import { IPaginationOptions } from "../../interface/pagination.type";
import { paginationHelper } from "../../utils/calculatePagination";
import ApiError from "../../errors/AppError";
import { Request } from "express";

// create ${Capitalized}
const create${Capitalized} = async (req: Request) => {
  const result = await prisma.${moduleName}.create({
    data:req.body
  });
  return result;
};

// get all ${Capitalized}
type I${Capitalized}FilterRequest = {
  searchTerm?: string;
  id?: string;
  createdAt?: string;
};

const ${moduleName}SearchAbleFields = ['fullName', 'email', 'userName'];

const get${Capitalized}List = async (
  options: IPaginationOptions,
  filters: I${Capitalized}FilterRequest
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.${Capitalized}WhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        ...${moduleName}SearchAbleFields.map((field) => ({
          [field]: {
            contains: searchTerm,
            mode: "insensitive",
          },
        })),
      ],
    });
  }

  if (Object.keys(filterData).length) {
    Object.keys(filterData).forEach((key) => {
      const value = (filterData as any)[key];
      if (value === "" || value === null || value === undefined) return;
      if (["createdAt"].includes(key) && value) {
        const start = new Date(value);
        start.setHours(0, 0, 0, 0);
        const end = new Date(value);
        end.setHours(23, 59, 59, 999);
        andConditions.push({
          createdAt: {
            gte: start.toISOString(),
            lte: end.toISOString(),
          },
        });
        return;
      }
      andConditions.push({ [key]: value });
    });
  }

  const whereConditions: Prisma.${Capitalized}WhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.${moduleName}.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: { createdAt: "desc" },
  });

  const total = await prisma.${moduleName}.count({ where: whereConditions });

  return {
    meta: { total, page, limit },
    data: result,
  };
};

// get ${Capitalized} by id
const get${Capitalized}ById = async (id: string) => {
  const result = await prisma.${moduleName}.findUnique({ where: { id } });
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, '${Capitalized} not found');
  }
  return result;
};

// update ${Capitalized}
const update${Capitalized} = async (id: string, data: any) => {
  const existing${Capitalized} = await prisma.${moduleName}.findUnique({ where: { id } });
  if (!existing${Capitalized}) {
    throw new ApiError(httpStatus.NOT_FOUND, '${Capitalized} not found');
  }

  const result = await prisma.${moduleName}.update({
    where: { id },
    data: {
      data: data.data ?? (existing${Capitalized} as any).data
    }
  });

  return result;
};

// delete ${Capitalized}
const delete${Capitalized} = async (id: string) => {
  const result = await prisma.${moduleName}.delete({ where: { id } });
  return result;
};

export const ${moduleName}Service = {
  create${Capitalized},
  get${Capitalized}List,
  get${Capitalized}ById,
  update${Capitalized},
  delete${Capitalized},
};
`.trim(),

    routes: `
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ${moduleName}Controller } from './${moduleName}.controller';
import { ${moduleName}Validation } from './${moduleName}.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest.body(${moduleName}Validation.createSchema),
  ${moduleName}Controller.create${Capitalized}
);

router.get('/', auth(), ${moduleName}Controller.get${Capitalized}List);

router.get('/:id', auth(), ${moduleName}Controller.get${Capitalized}ById);

router.put(
  '/:id',
  auth(),
  validateRequest.body(${moduleName}Validation.updateSchema),
  ${moduleName}Controller.update${Capitalized}
);

router.delete('/:id', auth(), ${moduleName}Controller.delete${Capitalized});

export const ${moduleName}Routes = router;
`.trim(),

    validation: await generateValidationFileContent(moduleName),
  };
};

/* =========================
 * ROUTE REGISTRATION
 * ========================= */
const registerRoute = moduleName => {
  if (!fs.existsSync(ROUTES_INDEX_PATH)) {
    console.error('❌ routes index.ts not found:', ROUTES_INDEX_PATH);
    return;
  }

  const routeVar = `${moduleName}Routes`;
  const routePath = `/${pluralize(moduleName.toLowerCase())}`;
  const importStatement = `import { ${routeVar} } from "../modules/${moduleName}/${moduleName}.routes";`;

  let fileContent = fs.readFileSync(ROUTES_INDEX_PATH, 'utf8');

  if (fileContent.includes(importStatement)) {
    console.log('⚠️ Route already registered, skipping...');
    return;
  }

  // insert import after last import
  const importRegex = /^import .*;$/gm;
  const imports = [...fileContent.matchAll(importRegex)];
  if (imports.length === 0) {
    console.error('❌ No import statements found in routes index.ts');
    return;
  }

  const lastImport = imports[imports.length - 1];
  const insertImportIndex = lastImport.index + lastImport[0].length;

  fileContent =
    fileContent.slice(0, insertImportIndex) +
    '\n' +
    importStatement +
    fileContent.slice(insertImportIndex);

  // add route entry into moduleRoutes array
  const routesArrayEndIndex = fileContent.indexOf(
    '];',
    fileContent.indexOf('const moduleRoutes'),
  );

  if (routesArrayEndIndex === -1) {
    console.error('❌ moduleRoutes array not found in routes index.ts');
    return;
  }

  const routeEntry = `
  {
    path: "${routePath}",
    route: ${routeVar},
  },`;

  fileContent =
    fileContent.slice(0, routesArrayEndIndex) +
    routeEntry +
    '\n' +
    fileContent.slice(routesArrayEndIndex);

  fs.writeFileSync(ROUTES_INDEX_PATH, fileContent);
  console.log(`✅ Route registered: ${routePath}`);
};

/* =========================
 * MAIN GENERATOR
 * ========================= */
const generateModule = async moduleName => {
  if (!moduleName) {
    console.error('❌ Please provide a module name!');
    process.exit(1);
  }

  if (!fs.existsSync(MODULES_DIR)) {
    fs.mkdirSync(MODULES_DIR, { recursive: true });
  }

  const modulePath = path.join(MODULES_DIR, moduleName);
  if (fs.existsSync(modulePath)) {
    console.error(`❌ Module '${moduleName}' already exists!`);
    process.exit(1);
  }

  fs.mkdirSync(modulePath, { recursive: true });

  const tpl = await templates(moduleName);

  Object.entries(tpl).forEach(([key, content]) => {
    const filePath = path.join(modulePath, `${moduleName}.${key}.ts`);
    fs.writeFileSync(filePath, content.trim());
    console.log(`✅ Created: ${filePath}`);
  });

  registerRoute(moduleName);
  console.log(`🎉 Module '${moduleName}' created successfully!`);
};

const [, , moduleName] = process.argv;

generateModule(moduleName).catch(e => {
  console.error('❌ Generate failed:', e.message);
  process.exit(1);
});
