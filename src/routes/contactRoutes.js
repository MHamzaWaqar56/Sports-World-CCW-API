import express from "express";
import {
  createMessage,
  getAllMessages,
  markAsRead,
  deleteMessage,
} from "../controllers/contactController.js";

const router = express.Router();

router.post("/", createMessage);
router.get("/getcontacts", getAllMessages);
router.put("/:id/read", markAsRead);
router.delete("/:id", deleteMessage);

export default router;