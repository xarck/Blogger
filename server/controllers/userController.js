import User from "../schema/User.js";
import Notification from "../schema/Notification.js";
import { formatDatatoSend } from "../utils/util.js";
import bcrypt from "bcrypt";
import { getAuth } from "firebase-admin/auth";

const userController = {
    signup: (req, res) => {
        let { fullname, email, password } = req.body;

        if (fullname.length < 3) {
            return res
                .status(403)
                .json({ error: "fullname must be at least 3 characters" });
        }
        if (!email.length) {
            return res.status(403).json({ error: "email required" });
        }
        if (!emailRegex.test(email)) {
            return res.status(403).json({ error: "email is invalid" });
        }
        if (!passwordRegex.test(password)) {
            return res.status(403).json({
                error: "Password should be 6 to 20 characters long with a numeric, lowercase and uppercase letter ",
            });
        }

        bcrypt.hash(password, 10, async (err, hashed_password) => {
            let username = await generateUsername(email);
            let user = new User({
                personal_info: {
                    fullname,
                    email,
                    password: hashed_password,
                    username,
                },
            });
            user.save()
                .then((u) => {
                    return res.status(200).json(formatDatatoSend(u));
                })

                .catch((err) => {
                    if (err.code == 11000) {
                        return res.status(500).json({
                            error: "Email already exists",
                        });
                    }
                    return res.status(500).json({ error: err.message });
                });
        });
    },

    signin: (req, res) => {
        let { email, password } = req.body;

        User.findOne({ "personal_info.email": email })
            .then((user) => {
                if (!user) {
                    return res.status(403).json({ error: "Email not found" });
                }
                if (!user.google_auth) {
                    bcrypt.compare(
                        password,
                        user.personal_info.password,
                        (err, result) => {
                            if (err) {
                                return res.status(403).json({
                                    error: "Error occured while logging in please try again",
                                });
                            }
                            if (!result) {
                                return res
                                    .status(403)
                                    .json({ error: "Incorrect Password" });
                            } else {
                                return res
                                    .status(200)
                                    .json(formatDatatoSend(user));
                            }
                        }
                    );
                } else {
                    return res.status(403).json({
                        error: "Account was created using google. Try logging in with google",
                    });
                }
            })
            .catch((err) => {
                console.log(err);
                return res.status(500).json({ error: err.message });
            });
    },

    googleAuth: (req, res) => {
        let { access_token } = req.body;
        getAuth()
            .verifyIdToken(access_token)
            .then(async (decodedUser) => {
                let { email, name, picture } = decodedUser;

                let user = await User.findOne({ "personal_info.email": email })
                    .select(
                        "personal_info.fullname personal_info.username personal_info.profile_img personal_info.google_auth "
                    )
                    .then((u) => {
                        return u || null;
                    })
                    .catch((err) => {
                        return res.status(500).json({ error: err.message });
                    });

                if (user) {
                    if (user.google_auth) {
                        return res.status(403).json({
                            error: "This email was registered without using Google sign-up. Please log in using your password to access your account.",
                        });
                    }
                } else {
                    let username = await generateUsername(email);
                    user = new User({
                        personal_info: {
                            fullname: name,
                            email,
                            profile_img: picture,
                            username,
                        },
                        google_auth: true,
                    });
                    await user
                        .save()
                        .then((u) => {
                            user = u;
                        })
                        .catch((err) => {
                            return res.status(500).json({ error: err.message });
                        });
                }
                return res.status(200).json(formatDatatoSend(user));
            })
            .catch((err) => {
                return res.status(500).json({
                    error: "Failed to authenticate you with Google. Try with some other Google account",
                });
            });
    },
    getProfile: (req, res) => {
        let { username } = req.body;
        User.findOne({ "personal_info.username": username })
            .select("-personal_info.password -google_auth -updatedAt -blogs")
            .then((user) => {
                return res.status(200).json(user);
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
    notifications: (req, res) => {
        let user_id = req.user;

        let { page, filter, deletedDocCount } = req.body;

        let maxLimit = 10;
        let findQuery = { notification_for: user_id, user: { $ne: user_id } };

        let skipDocs = (page - 1) * maxLimit;

        if (filter != "all") {
            findQuery.type = filter;
        }
        if (deletedDocCount) {
            skipDocs -= deletedDocCount;
        }

        Notification.find(findQuery)
            .skip(skipDocs)
            .limit(maxLimit)
            .populate("blog", "title blog_id")
            .populate(
                "user",
                "personal_info.fullname personal_info.username personal_info.profile_img"
            )
            .populate("comment", "comment")
            .populate("replied_on_comment", "comment")
            .populate("reply", "comment")
            .sort({ createdAt: -1 })
            .select(" createdAt type seen reply ")
            .then((notifications) => {
                Notification.updateMany(findQuery, { seen: true })
                    .skip(skipDocs)
                    .limit(maxLimit)
                    .then(() => console.log("notification seen "));
                return res.status(200).json({ notifications });
            })
            .catch((err) => {
                console.log(err.message);
                return res.status(500).json({ error: err.message });
            });
    },
    newNotification: (req, res) => {
        let user_id = req.user;
        Notification.exists({
            notification_for: user_id,
            seen: false,
            user: { $ne: user_id },
        })
            .then((result) => {
                if (result) {
                    return res
                        .status(200)
                        .json({ new_notification_available: true });
                } else {
                    return res
                        .status(200)
                        .json({ new_notification_available: false });
                }
            })
            .catch((err) => {
                console.log(err.message);
                return res.status(500).json({ error: err.message });
            });
    },
    isLikedByUser: (req, res) => {
        let user_id = req.user;

        let { _id } = req.body;

        Notification.exists({ user: user_id, type: "like", blog: _id })
            .then((result) => {
                return res.status(200).json({ result });
            })
            .catch((err) => {
                console.log("gave error");
                return res.status(500).json({ error: err.message });
            });
    },
    updateProfile: (req, res) => {
        let { username, bio, social_links } = req.body;

        let bioLimit = 150;

        if (username.length < 3) {
            return res
                .status(403)
                .json({ error: "Username should be at least 3 characters" });
        }
        if (bio.length > bioLimit) {
            return res
                .status(403)
                .json({ error: `Bio should be within ${bioLimit}` });
        }

        let socialLinksArr = Object.keys(social_links);
        try {
            for (let i = 0; i < socialLinksArr.length; i++) {
                if (social_links[socialLinksArr[i]].length) {
                    let hostname = new URL(social_links[socialLinksArr[i]])
                        .hostname;

                    if (
                        !hostname.includes(`${socialLinksArr[i]}.com`) &&
                        socialLinksArr[i] != "website"
                    ) {
                        return res.status(403).json({
                            error: `${socialLinksArr[i]} link is invalid. You must enter a full link `,
                        });
                    }
                }
            }
        } catch (err) {
            return res.status(500).json({
                error: "You must provide valid links with http(s) included",
            });
        }

        let updateObj = {
            "personal_info.username": username,
            "personal_info.bio": bio,
            social_links,
        };

        User.findOneAndUpdate({ _id: req.user }, updateObj, {
            runValidators: true,
        })
            .then(() => {
                return res.status(200).json({ username });
            })
            .catch((err) => {
                if (err.code == 11000) {
                    return res
                        .status(409)
                        .json({ error: "Username is already in use" });
                }

                return res.status(500).json({ error: err.message });
            });
    },
    updateProfileImg: (req, res) => {
        let { url } = req.body;
        User.findOneAndUpdate(
            { _id: req.user },
            { "personal_info.profile_img": url }
        )
            .then(() => {
                return res.status(200).json({ profile_img: url });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
    searchUser: (req, res) => {
        let { query } = req.body;
        User.find({ "personal_info.username": new RegExp(query, "i") })
            .limit(50)
            .select(
                "personal_info.fullname personal_info.username personal_info.profile_img -_id"
            )

            .then((users) => {
                return res.status(200).json({ users });
            })
            .catch((err) => {
                return res.status(500).json({ error: err.message });
            });
    },
    changePassword: (req, res) => {
        let { currentPassword, newPassword } = req.body;

        if (
            !passwordRegex.test(currentPassword) ||
            !passwordRegex.test(newPassword)
        ) {
            return res.status(403).json({
                error: "Password should be 6 to 20 characters long with a numeric,  lowercase, and uppercase letter",
            });
        }

        User.findOne({ _id: req.user })
            .then((user) => {
                if (user.google_auth) {
                    return res.status(403).json({
                        error: "You cannot change password as you signed in with Google Auth",
                    });
                }

                bcrypt.compare(
                    currentPassword,
                    user.personal_info.password,
                    (err, result) => {
                        if (err) {
                            return res.status(500).json({
                                error: "Some error occured while changing password please try again later",
                            });
                        }

                        if (!result) {
                            return res
                                .status(403)
                                .json({ error: "Incorrect current password" });
                        }

                        bcrypt.hash(newPassword, 10, (err, hashed_password) => {
                            User.findOneAndUpdate(
                                { _id: req.user },
                                { "personal_info.password": hashed_password }
                            )
                                .then((u) => {
                                    return res.status(200).json({
                                        status: "Password changed Successfully ",
                                    });
                                })
                                .catch((err) => {
                                    return res.status(500).json({
                                        error: "Error occured while saving new password please try again later",
                                    });
                                });
                        });
                    }
                );
            })
            .catch((err) => {
                console.log(err);
                return res.status(500).json({ error: "User not found" });
            });
    },

    // Other user-related functions
};

export default userController;
