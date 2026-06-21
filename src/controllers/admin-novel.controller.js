import { GlobalNovel } from "../models/global-novel.model.js";
import { NovelAddRequest } from "../models/novel-add-request.model.js"

const viewRequest = async (req, res) => {

    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Access denied" });
    }
    try {
        const novel = await NovelAddRequest.find({});
        if (novel.length === 0) {
            return res.status(404).json({
                message: "No record found"
            });
        }
        return res.status(200).json({
            message: "Novel fetched successfully",
            novels: novel
        });
    }
    catch (error) {
        return res.status(500).json({
            message: "Something went wrong"
        });
    }
}


const approveRequest = async (req, res) => {

    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Access denied" });
    }
    const { novelId } = req.params;
    try {
        const novelToApprove = await NovelAddRequest.findById(novelId);
        if (!novelToApprove) {
            return res.status(404).json({
                message: "Novel not found",
            });
        }

        const novelData = novelToApprove.toObject();

        delete novelData._id;
        delete novelData.createdBy;
        delete novelData.isApproved;
        delete novelData.createdAt;
        delete novelData.updatedAt;

        const globalNovel = await GlobalNovel.create({
            ...novelData,
            isApproved: true
        });

        await novelToApprove.deleteOne();

        return res.status(200).json({
            message: "Approved by admin: Novel added to global db",
            novel: globalNovel
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong"
        });
    }
}


const rejectRequest = async (req, res) => {

    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Access denied" });
    }
    const { novelId } = req.params;
    try {
        const novelToReject = await NovelAddRequest.findById(novelId);

        if (!novelToReject) {
            return res.status(404).json({
                message: "Novel not found",
            });
        }

        const deleteResult = await NovelAddRequest.deleteOne({ _id: novelId });
        if (deleteResult.deletedCount === 1) {
            return res.status(200).json({
                message: "Novel rejected & deleted successfully",
            });
        } else {
            return res.status(500).json({
                message: "Failed to delete the request",
            });
        }
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong"
        });
    }
}

export { viewRequest, approveRequest, rejectRequest };