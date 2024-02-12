import User from "../schema/User.js";
import Blog from "../schema/Blog.js";
import Notification from "../schema/Notification.js";
import Comment from "../schema/Comment.js";
import cloudinary from "../utils/cloudinaryConfig.js";

import { nanoid } from "nanoid";

const blogController = {
    uploadBanner: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const result = await cloudinary.uploader
                .upload_stream(
                    { folder: "blog_banners" },
                    async (error, result) => {
                        if (result) {
                            res.json({ secure_url: result.secure_url });
                        } else {
                            console.error("Error uploading image: ", error);
                            res.status(500).json({
                                error: "Something went wrong",
                            });
                        }
                    }
                )
                .end(req.file.buffer);
        } catch (error) {
            console.error("Error uploading image: ", error);
            res.status(500).json({ error: "Something went wrong" });
        }
    },

    latestBlogs: (req, res) => {
        let { page } = req.body;

        let maxLimit = 5;

        Blog.find({ draft: false })
            .populate(
                "author",
                "personal_info.profile_img personal_info.username personal_info.fullname -_id"
            )
            .sort({ publishedAt: -1 })
            .select(
                "blog_id title des content banner activity tags publishedAt minutesRead  -_id"
            )
            .skip((page - 1) * maxLimit)
            .limit(maxLimit)
            .then((blogs) => {
                return res.status(200).json({ blogs });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },

    trendingBlogs: (req, res) => {
        Blog.find({ draft: false })
            .populate(
                "author",
                "personal_info.profile_img personal_info.username personal_info.fullname -_id"
            )
            .sort({
                "activity.total_read": -1,
                "activity.total_likes": -1,
                publishedAt: -1,
            })
            .select("blog_id title publishedAt -_id")
            .limit(5)
            .then((blogs) => {
                return res.status(200).json({ blogs });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },

    createBlog: async (req, res) => {
        let authorId = req.user;
        let { title, des, banner, tags, content, draft, id } = req.body;

        if (!title.length) {
            return res.status(403).json({ error: "you must provide a title" });
        }

        if (!draft) {
            if (!des.length || des.length > 200) {
                return res.status(403).json({
                    error: "Blog description should be under 200 character limit",
                });
            } else if (!banner.length) {
                return res.status(403).json({
                    error: "Blog Banner is required in order to publish",
                });
            } else if (!content.blocks.length) {
                return res
                    .status(403)
                    .json({ error: "There must be some content to publish" });
            } else if (!tags.length || tags.length > 10) {
                return res.status(403).json({
                    error: "Tags are required in order to publish, Max limit is 10",
                });
            }
        }

        tags = tags.map((tag) => tag.toLowerCase());

        let blog_id =
            id ||
            title.replace(/[^a-zA-Z0-9]/g, " ").replace(/\s+/g, "-") + nanoid();

        const readTime = await calculateReadTime(content);

        if (id) {
            Blog.findOneAndUpdate(
                { blog_id: id },
                {
                    title,
                    des,
                    banner,
                    content,
                    tags,
                    draft: draft ? draft : false,
                    minutesRead: readTime,
                }
            )
                .then(() => {
                    return res.status(200).json({ id: blog_id });
                })
                .catch((err) => {
                    return res.status(500).json({ error: err.message });
                });
        } else {
            let blog = new Blog({
                title,
                des,
                banner,
                content,
                tags,
                author: authorId,
                blog_id,
                draft: Boolean(draft),
                minutesRead: readTime,
            });

            blog.save()
                .then((blog) => {
                    let incrementBlog = draft ? 0 : 1;
                    User.findOneAndUpdate(
                        { _id: authorId },
                        {
                            $inc: { "account_info.total_posts": incrementBlog },
                            $push: { blogs: blog._id },
                        }
                    )
                        .then((user) => {
                            return res.status(200).json({ id: blog.blog_id });
                        })
                        .catch((err) => {
                            return res.status(500).json({
                                error: "Failed to update total posts number",
                            });
                        });
                })
                .catch((err) => {
                    return res.status(500).json({ error: err.message });
                });
        }
    },

    getBlog: (req, res) => {
        let { blog_id, draft, mode } = req.body;

        let incrementVal = mode != "edit" ? 1 : 0;

        Blog.findOneAndUpdate(
            { blog_id },
            { $inc: { "activity.total_reads": incrementVal } }
        )
            .populate(
                "author",
                "personal_info.fullname personal_info.username personal_info.profile_img"
            )
            .select(
                "title des content banner activity publishedAt blog_id tags minutesRead"
            )
            .then((blog) => {
                User.findOneAndUpdate(
                    {
                        "personal_info.username":
                            blog.author.personal_info.username,
                    },
                    { $inc: { "account_info.total_reads": incrementVal } }
                ).catch((err) => {
                    return res.status(500).json({ error: err.message });
                });
                if (blog.draft && !draft) {
                    return res
                        .status(500)
                        .json({ error: "you cannot access draft blog" });
                }
                return res.status(200).json({ blog });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
    deleteBlog: (req, res) => {
        let user_id = req.user;
        let { blog_id } = req.body;

        Blog.findOneAndDelete({ blog_id })
            .then((blog) => {
                Notification.deleteMany({ blog: blog._id }).then((data) =>
                    console.log("Notifications deleted")
                );

                Comment.deleteMany({ blog_id: blog._id }).then((data) =>
                    console.log("Comments deleted")
                );

                User.findOneAndUpdate(
                    { _id: user_id },
                    {
                        $pull: { blog: blog._id },
                        $inc: {
                            "account_info.total_posts": blog.draft ? 0 : -1,
                        },
                    }
                ).then((user) => console.log(`Blog deleted`));

                return res.status(200).json({ status: "done" });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
    userWrittenBlogs: (req, res) => {
        let user_id = req.user;

        let { page, draft, query, deletedDocCount } = req.body;

        let maxLimit = 5;
        let skipDocs = (page - 1) * maxLimit;

        if (deletedDocCount) {
            skipDocs = skipDocs - deletedDocCount;
        }

        Blog.find({ author: user_id, draft, title: new RegExp(query, "i") })
            .skip(skipDocs)
            .limit(maxLimit)
            .sort({ publishedAt: -1 })
            .select("title banner publishedAt blog_id activity des draft -_id")
            .then((blogs) => {
                return res.status(200).json({ blogs: blogs });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
    allNotificationCount: (req, res) => {
        let user_id = req.user;
        let { filter } = req.body;
        let findQuery = { notification_for: user_id, user: { $ne: user_id } };

        if (filter != "all") {
            findQuery.type = filter;
        }
        Notification.countDocuments(findQuery)
            .then((count) => {
                return res.status(200).json({ totalDocs: count });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
    latestBlogsCount: (req, res) => {
        Blog.countDocuments({ draft: false })
            .then((count) => {
                return res.status(200).json({ totalDocs: count });
            })
            .catch((err) => {
                console.log(err.message);
                return res.status(500).json({ error: err.message });
            });
    },
    searchBlogs: (req, res) => {
        let { tag, query, author, page, limit, eliminate_blog } = req.body;
        let findQuery;

        if (tag) {
            findQuery = {
                tags: tag,
                draft: false,
                blog_id: { $ne: eliminate_blog },
            };
        } else if (query) {
            findQuery = { title: new RegExp(query, "i"), draft: false };
        } else if (author) {
            findQuery = { author, draft: false };
        }
        let maxLimit = limit ? limit : 5;
        Blog.find(findQuery)
            .populate(
                "author",
                "personal_info.profile_img personal_info.username personal_info.fullname -_id"
            )
            .sort({ publishedAt: -1 })
            .select(
                "blog_id title des banner activity tags publishedAt minutesRead -_id"
            )
            .skip((page - 1) * maxLimit)
            .limit(maxLimit)
            .then((blogs) => {
                return res.status(200).json({ blogs });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
    searchBlogsCount: (req, res) => {
        let { tag, author, query } = req.body;

        let findQuery;

        if (tag) {
            findQuery = { tags: tag, draft: false };
        } else if (query) {
            findQuery = { title: new RegExp(query, "i"), draft: false };
        } else if (author) {
            findQuery = { author, draft: false };
        }

        Blog.countDocuments(findQuery)
            .then((count) => {
                return res.status(200).json({ totalDocs: count });
            })
            .catch((err) => {
                console.log(err.message);
                return res.status(500).json({ error: err.message });
            });
    },
    blogCount: (req, res) => {
        let user_id = req.user;

        let { draft, query } = req.body;

        Blog.countDocuments({
            author: user_id,
            draft,
            title: new RegExp(query, "i"),
        })
            .then((count) => {
                return res.status(200).json({ totalDocs: count });
            })
            .catch((err) => {
                console.log(err.message);
                return res.status(500).json({ error: err.message });
            });
    },
    likeBlog: (req, res) => {
        const user_id = req.user;
        const { _id, isLikedByUser } = req.body;

        Blog.findOneAndUpdate(
            { _id },
            { $inc: { "activity.total_likes": incrementVal } }
        )
            .then((blog) => {
                if (!isLikedByUser) {
                    const like = new Notification({
                        type: "like",
                        blog: _id,
                        notification_for: blog.author,
                        user: user_id,
                    });

                    like.save().then((notification) => {
                        return res.status(200).json({ liked_by_user: true });
                    });
                } else {
                    Notification.findOneAndDelete({
                        user: user_id,
                        blog: _id,
                        type: "like",
                    })
                        .then((data) => {
                            return res
                                .status(200)
                                .json({ liked_by_user: false });
                        })
                        .catch((err) => {
                            return res.status(500).json({ error: err.message });
                        });
                }
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
};

export default blogController;
