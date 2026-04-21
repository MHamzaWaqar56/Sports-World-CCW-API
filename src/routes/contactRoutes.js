import express from "express";
import {
  createMessage,
  getAllMessages,
  deleteMessage,
} from "../controllers/contactController.js";

const router = express.Router();

router.post("/", createMessage);
router.get("/getcontacts", getAllMessages);
router.delete("/:id", deleteMessage);

export default router;