import asyncHandler from "../utils/async.handler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

/* ================= TOKENS ================= */

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch {
        throw new ApiError(500, "Token generation failed");
    }
};

/* ================= REGISTER ================= */

const registerUser = asyncHandler(async (req, res) => {
    const { fullname, username, email, password } = req.body;

    if ([fullname, username, email, password].some(v => !v || v.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existingUser = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (existingUser) {
        throw new ApiError(409, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadToCloudinary(avatarLocalPath);
    const coverImage = coverImageLocalPath
        ? await uploadToCloudinary(coverImageLocalPath)
        : null;

    if (!avatar) {
        throw new ApiError(500, "Failed to upload avatar");
    }

    const user = await User.create({
        fullname,
        username: username.toLowerCase(),
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});

/* ================= LOGIN ================= */

const loginuser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    if (!email && !username) {
        throw new ApiError(400, "Email or username is required");
    }

    const user = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged in successfully"
            )
        );
});

/* ================= LOGOUT ================= */

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "User logged out successfully"));
});

/* ================= REFRESH TOKEN ================= */

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token missing");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken._id);

        if (!user || incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Invalid refresh token");
        }

        const { accessToken, refreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        const options = {
            httpOnly: true,
            secure: true
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
                    "Access token refreshed successfully"
                )
            );
    } catch {
        throw new ApiError(401, "Invalid refresh token");
    }
});

/* ================= PASSWORD ================= */

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Password changed successfully"));
});

/* ================= CURRENT USER ================= */

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

/* ================= UPDATE ACCOUNT ================= */

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;

    if (!fullname || !email) {
        throw new ApiError(400, "Fullname and email are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { fullname, email } },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User details updated successfully"));
});

/* ================= AVATAR ================= */

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadToCloudinary(avatarLocalPath);

    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { avatar: avatar.url } }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Avatar updated successfully"));
});

/* ================= COVER IMAGE ================= */

const updatecoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is required");
    }

    const coverImage = await uploadToCloudinary(coverImageLocalPath);

    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { coverImage: coverImage.url } }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Cover image updated successfully"));
});

/* ================= CHANNEL PROFILE ================= */

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is required");
    }

    const channel = await User.aggregate([
        { $match: { username: username.toLowerCase() } },
        {
            $project: {
                fullname: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                createdAt: 1
            }
        }
    ]);

    if (!channel.length) {
        throw new ApiError(404, "Channel not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "Channel profile fetched successfully")
        );
});

/* ================= WATCH HISTORY ================= */

const getWatchedHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(req.user._id) } },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory"
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0]?.watchHistory || [],
                "Watched history fetched successfully"
            )
        );
});

/* ================= EXPORTS ================= */

export {
    registerUser,
    loginuser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    updateAccountDetails,
    updateAvatar,
    updatecoverImage,
    getWatchedHistory,
    getUserChannelProfile
};
