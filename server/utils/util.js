import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";

const generateUsername = async (email) => {
    let username = email.split("@")[0];
    let isUsernameNotUnique = await User.exists({
        "personal_info.username": username,
    }).then((result) => result);
    isUsernameNotUnique ? (username += nanoid().substring(0, 5)) : "";
    return username;
};

async function calculateReadTime(contentArray) {
    let wordCount = 0;

    if (
        typeof contentArray === "object" &&
        Object.keys(contentArray).length > 0
    ) {
        const blocks = contentArray.blocks;

        if (Array.isArray(blocks)) {
            blocks.forEach((block) => {
                if (block && block.data) {
                    if (
                        block.type === "header" ||
                        block.type === "paragraph" ||
                        block.type === "quote"
                    ) {
                        if (block.data.text) {
                            const words = block.data.text
                                .split(/\s+/)
                                .filter((word) => word.trim() !== "");
                            wordCount += words.length;
                        }
                    } else if (block.type === "warning") {
                        if (block.data.title) {
                            const titleWords = block.data.title
                                .split(/\s+/)
                                .filter((word) => word.trim() !== "");
                            wordCount += titleWords.length;
                        }
                        if (block.data.message) {
                            const messageWords = block.data.message
                                .split(/\s+/)
                                .filter((word) => word.trim() !== "");
                            wordCount += messageWords.length;
                        }
                    }
                }
            });
        }
    }
    const estimatedReadTimeInMinutes =
        Math.ceil(wordCount / wordsPerMinute) + 1;
    return estimatedReadTimeInMinutes;
}

const formatDatatoSend = (user) => {
    const access_token = jwt.sign(
        { id: user._id },
        process.env.SECRET_ACCESS_KEY
    );
    return {
        access_token,
        profile_img: user.personal_info.profile_img,
        username: user.personal_info.username,
        fullname: user.personal_info.fullname,
    };
};

export { generateUsername, calculateReadTime, formatDatatoSend }; // Make sure to export the function
