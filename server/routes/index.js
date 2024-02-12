import express from "express";
import userController from "../controllers/userController.js";
import blogController from "../controllers/blogController.js";
import commentController from "../controllers/commentController.js";
import verifyJWT from "../utils/verify.js";
import upload from "../utils/multerConfig.js";

const router = express.Router();

// User Routes
router.post("/signup", userController.signup);
router.post("/signin", userController.signin);
router.post("/google-auth", userController.googleAuth);
router.post("/change-password", verifyJWT, userController.changePassword);
router.post("/search-users", userController.searchUser);
router.post("/get-profile", userController.getProfile);
router.post("/update-profile-img", verifyJWT, userController.updateProfileImg);
router.post("/notifications", verifyJWT, userController.notifications);
router.get("/new-notification", verifyJWT, userController.newNotification);
router.post("/isliked-by-user", verifyJWT, userController.isLikedByUser);
router.post("update-profile", verifyJWT, userController.updateProfile);

// Blog Routes
router.post(
    "/uploadBanner",

    upload.single("file"),
    blogController.uploadBanner
);
router.post("/latest-blogs", blogController.latestBlogs);
router.get("/trending-blogs", blogController.trendingBlogs);
router.post("/create-blog", verifyJWT, blogController.createBlog);
router.post("/get-blog", blogController.getBlog);
router.post("/like-blog", verifyJWT, blogController.likeBlog);
router.post("/delete-blog", verifyJWT, blogController.deleteBlog);
router.post("/user-written-blogs-count", blogController.blogCount);
router.post("/user-written-blogs", verifyJWT, blogController.userWrittenBlogs);
router.post(
    "/all-notifications-count",
    verifyJWT,
    blogController.allNotificationCount
);
router.post("/all-latest-blogs-count", blogController.latestBlogsCount);
router.post("/search-blogs", blogController.searchBlogs);
router.post("/search-blogs-count", blogController.searchBlogsCount);

// Comment Routes
router.post("/add-comment", verifyJWT, commentController.addComment);
router.post("/get-blog-comments", commentController.getComments);
router.post("/get-replies", commentController.getReplies);
router.post("/delete-comment", verifyJWT, commentController.deleteComment);

export default router;
