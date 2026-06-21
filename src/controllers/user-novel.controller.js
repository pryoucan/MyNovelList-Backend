import mongoose from "mongoose";
import { GlobalNovel } from "../models/global-novel.model.js";
import { UserNovel } from "../models/user-novel.model.js";

const viewUserNovel = async (req, res) => {
  try {
    const userId = req.user.id;
    const novels = await UserNovel.find({ user: userId });

    return res.status(200).json({
      message: "Novels fetched successfully",
      novels,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const getUserNovelByGId = async (req, res) => {
  const { novelId } = req.params;
  if(!novelId) {
    return res.status(400).json({ message: "Global Novel Id required" });
  } 

  try {
    const novel = await UserNovel.findOne({ novel: novelId, user: req.user.id });
    if(!novel) {
      return res.status(404).json({ message: "Novel not found" });
    }

    return res.status(200).json({ message: "Novel found successfully",
      novel
    });
  }
  catch(error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const getUserNovelById = async (req, res) => {
  try {
    const { novelId } = req.params;
    const userId = req.user.id;
    if (!novelId) {
      return res.status(400).json({ message: "Novel id is required" });
    }

    const novel = await UserNovel.findOne({ user: userId, _id: novelId });

    if (!novel) {
      return res.status(404).json({
        message: "Novel not found",
      });
    }

    return res.status(200).json({
      message: "Novel found successfully",
      novel,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const getUserNovelByName = async (req, res) => {
  try {
    const { n } = req.query;
    if (!n) {
      return res.status(400).json({ message: "Novel name is required" });
    }

    const userId = req.user.id;

    const matchingGlobalNovels = await GlobalNovel.find(
      { $text: { $search: n } },
      { _id: 1 }
    );
    const globalNovelIds = matchingGlobalNovels.map((g) => g._id);

    const novels = await UserNovel.find({
      novel: { $in: globalNovelIds },
      user: new mongoose.Types.ObjectId(userId),
    });

    if (novels.length === 0) {
      return res.status(404).json({
        message: "Novel not found",
      });
    }

    return res.status(200).json({
      message: "Novel found successfully",
      novels,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const addUserNovel = async (req, res) => {
  const { novelId } = req.params;
  const { status, progress, rating, startedAt, completedAt } = req.body || {};

  if (!novelId) {
    return res.status(400).json({ message: "Novel id is required" });
  }

  try {
    const novel = await GlobalNovel.findById(novelId);
    if (!novel) {
      return res.status(404).json({ message: "Novel not found" });
    }

    const alreadyExists = await UserNovel.findOne({
      novel: novelId,
      user: req.user.id,
    });

    if (alreadyExists) {
      return res.status(409).json({ message: "Novel already in your list" });
    }

    const upcomingForbiddenStatus = ["Reading", "Completed", "On Hold", "Dropped"];
    if (status !== undefined &&
      novel.publication.status === "Upcoming" &&
      upcomingForbiddenStatus.includes(status)
    ) {
      return res.status(400).json({
        message:
          "This novel has not released yet, you cannot mark it as anything but Plan To Read",
      });
    }

    let strictStatus = status ?? "Reading";
    if(novel.publication.status === "Upcoming") {
      strictStatus = "Plan To Read";
    }

    if ((novel.publication.status === "Upcoming") &&
    (
      progress !== undefined ||
      rating !== undefined ||
      startedAt !== undefined ||
      completedAt !== undefined
    )) {
      return res.status(400).json({
        message: `You cannot set progress, rating, or dates for an unreleased novel`,
      });
    }

    if((status === "Plan To Read") &&
      (
        progress !== undefined ||
        rating !== undefined ||
        startedAt !== undefined ||
        completedAt !== undefined
    )) {
      return res.status(400).json({
        message: "You cannot set any field if the status is Plan To Read" 
      });
    }

    let progressCount = progress;
    if (
      typeof progress === "number" &&
      novel.chapterCount > 0 &&
      progress > novel.chapterCount
    ) {
      progressCount = novel.chapterCount;
    }

    const userNovel = await UserNovel.create({
      user: req.user.id,
      novel: novelId,
      status: strictStatus,
      progress: progressCount,
      rating,
      startedAt,
      completedAt,
    });

    return res.status(201).json({
      message: "Novel added to your list",
      userNovel,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const editUserNovel = async (req, res) => {
  const { novelId } = req.params;
  const { status, progress, rating, startedAt, completedAt } = req.body || {};

  if (!novelId) {
    return res.status(400).json({ message: "Novel id is required" });
  }

  try {
    const userNovel = await UserNovel.findOne({ _id: novelId, user: req.user.id });
    if (!userNovel) {
      return res.status(404).json({ message: "Novel not found" });
    }

    const globalNovelId = userNovel.novel;

    const novel = await GlobalNovel.findById(globalNovelId);
    if(!novel) {
      return res.status(404).json({ message: "Novel not found" });
    }

    const upcomingForbiddenStatus = ["Reading", "Completed", "On Hold", "Dropped"];
    if (status !== undefined &&
      novel.publication.status === "Upcoming" &&
      upcomingForbiddenStatus.includes(status)
    ) {
      return res.status(400).json({
        message:
          "This novel has not released yet, you cannot mark it as anything but Plan To Read",
      });
    }

    if (
      (novel.publication.status === "Upcoming") &&
      (progress !== undefined ||
        rating !== undefined ||
        startedAt !== undefined ||
        completedAt !== undefined)
    ) {
      return res.status(400).json({
        message: `You cannot set progress, rating, or dates for an unreleased novel`,
      });
    }

    const effectiveStatus = status ?? userNovel.status;

    // "Plan To Read" entries cannot carry any reading progress or dates.
    // If the user is switching TO this status, clear those fields automatically.
    // If they are STAYING at this status and try to set one of those fields, reject it.
    if (effectiveStatus === "Plan To Read") {
      if (status !== undefined) {
        // Switching to Plan To Read — auto-clear all reading state.
        // Any explicitly provided incompatible fields are ignored in favour of the clear.
      } else if (
        progress !== undefined ||
        rating !== undefined ||
        startedAt !== undefined ||
        completedAt !== undefined
      ) {
        return res.status(400).json({
          message: "You cannot set progress, rating, or dates while status is Plan To Read",
        });
      }
    }

    // "Completed" requires a completedAt date.
    // Fall back to the existing DB value so that transitioning back to Completed
    // after a temporary status change doesn't force the user to re-supply the date.
    if (effectiveStatus === "Completed") {
      const resolvedCompletedAt = completedAt ?? userNovel.completedAt;
      if (!resolvedCompletedAt) {
        return res.status(400).json({
          message: "completedAt is required when status is Completed",
        });
      }
    }

    let progressCount = progress;
    if (
      typeof progress === "number" &&
      novel.chapterCount > 0 &&
      progress > novel.chapterCount
    ) {
      progressCount = novel.chapterCount;
    }

    const allowed_fields = ["status", "progress", "rating", "startedAt", "completedAt"];
    const updates = {};
    for (const key of allowed_fields) {
      if (req.body[key] !== undefined) {
        updates[key] = key === "progress" ? progressCount : req.body[key];
      }
    }

    // Enforce field invariants based on the resolved target status.
    if (effectiveStatus === "Plan To Read") {
      updates.progress = 0;
      updates.rating = null;
      updates.startedAt = null;
      updates.completedAt = null;
    } else if (effectiveStatus !== "Completed") {
      // Reading / On Hold / Dropped — a completedAt makes no sense; clear it.
      updates.completedAt = null;
    }

    const updatedEntry = await UserNovel.findOneAndUpdate(
      {
        _id: novelId,
        user: req.user.id,
      },
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      message: "Novel updated successfully",
      updatedEntry,
    });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const deleteUserNovel = async (req, res) => {
  try {
    const { novelId } = req.params;
    const userId = req.user.id;

    const novel = await UserNovel.findOne({ _id: novelId, user: userId });
    if (!novel) {
      return res.status(404).json({ message: "Novel not found" });
    }

    const result = await UserNovel.deleteOne({ _id: novelId, user: userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Cannot delete the novel" });
    }

    return res.status(200).json({ message: "Novel deleted successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export {
  viewUserNovel,
  getUserNovelByGId,
  getUserNovelById,
  getUserNovelByName,
  addUserNovel,
  editUserNovel,
  deleteUserNovel
};
