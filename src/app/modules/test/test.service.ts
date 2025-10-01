
import { Request } from "express";

const createIntoDb = async (req:Request) => {

  return null;
};

const getAllTest = async (query: Record<string, any>) => {
  console.log(query);
  return [];
};

const getMyTest = async (userId: string) => {  
 
  console.log('Fetching my test for user:', userId);
  return []; 
};

const getTestByIdFromDB = async (id: string) => {
  console.log(id);
  return null;
};

const updateIntoDb = async (id: string, data: Partial<any>) => {
  console.dir({ id, data });
  return null;
};

const deleteIntoDb = async (id: string) => {
  console.log(id);
  return null;
};

const softDeleteIntoDb = async (id: string) => {
  console.log(id);
  return null;
};

export const TestServices = {
  createIntoDb,
  getAllTest,
  getMyTest, 
  getTestByIdFromDB,
  updateIntoDb,
  deleteIntoDb,
  softDeleteIntoDb,
};
