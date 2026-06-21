import { GlobalNovel } from "../models/global-novel.model.js"

const viewNovel = async (req, res) => {
    try {
        const novels = await GlobalNovel.find({});
        if(!novels.length) {
            return res.status(404).json({
                message: "Novel not found"
            });
        }

        return res.status(200).json({
            message: "Novel fetched successfully",
            novels
        });
    }
    catch(error) {
        return res.status(500).json({ message: "Something went wrong" });
    }
}


const getNovelById = async (req, res) => {
    const { id } = req.params;

    try {
        const novel = await GlobalNovel.findById(id);
        if(!novel) {
            return res.status(404).json({
                message: "No novels found"
            });
        }
        return res.status(200).json({
            message: "Novel found",
            novel
        });
    }
    catch(error) {
        return res.status(500).json({
            message: "Something went wrong"
        });
    }
}


const getNovelByName = async (req, res) => {
    const { q } = req.query;
    if(!q) {
        return res.status(400).json({ message: "Novel name required" });
    }

    try {
        const novels = await GlobalNovel.find({ $text: { $search: q } });
        if(!novels.length) {
            return res.status(404).json({ message: "Novel not found"});
        }

        return res.status(200).json({
            message: "Novel found",
            novels
        });
    }
    catch(error) {
        console.log(error)
        return res.status(500).json({ message: "Something went wrong" });
    }
}

export { viewNovel, getNovelById, getNovelByName };