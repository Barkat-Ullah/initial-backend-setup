import express from "express";
import { TestController } from "./test.controller";
import validateRequest from "../../middlewares/validateRequest";
import { TestValidation } from "./test.validation";

const router = express.Router();

router.get("/", TestController.getAllTest);
router.get("/my", TestController.getMyTest);  
router.get("/:id", TestController.getTestById);

router.post(
  "/",
  validateRequest.body(TestValidation.createTestZodSchema),
  TestController.createIntoDb
);

router.patch(
  "/:id",
  validateRequest.body(TestValidation.updateTestZodSchema),
  TestController.updateIntoDb
);

router.delete("/:id", TestController.deleteIntoDb);
router.delete("/soft/:id", TestController.softDeleteIntoDb);

export const TestRoutes = router;
