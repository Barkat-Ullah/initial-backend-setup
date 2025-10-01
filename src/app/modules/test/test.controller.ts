import catchAsync from "../../utils/catchAsync";
import httpStatus from "http-status";
import sendResponse from "../../utils/sendResponse";
import { Request, Response } from "express";
import { TestServices } from "./test.service";

const createIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await TestServices.createIntoDb(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Successfully created test",
    data: result,
  });
});

const getAllTest = catchAsync(async (req: Request, res: Response) => {
  const result = await TestServices.getAllTest(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Successfully retrieved all test",
    data: result,
  });
});

const getMyTest = catchAsync(async (req: Request, res: Response) => {  
  const result = await TestServices.getMyTest(req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Successfully retrieved my test",
    data: result,
  });
});

const getTestById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TestServices.getTestByIdFromDB(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Successfully retrieved test by id",
    data: result,
  });
});

const updateIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TestServices.updateIntoDb(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Successfully updated test",
    data: result,
  });
});

const deleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TestServices.deleteIntoDb(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Successfully deleted test",
    data: result,
  });
});

const softDeleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TestServices.softDeleteIntoDb(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Successfully soft deleted test",
    data: result,
  });
});

export const TestController = {
  createIntoDb,
  getAllTest,
  getMyTest, 
  getTestById,
  updateIntoDb,
  deleteIntoDb,
  softDeleteIntoDb,
};
