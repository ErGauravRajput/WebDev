import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens=async(userid)=>{
    const user=await User.findById(userid);
    const accessToken=user.generateAccessToken();
    const refreshToken=user.generateRefreshToken();
    user.refreshToken=refreshToken;
    await user.save({validateBeforeSave:false});
    return {accessToken,refreshToken};

};

const registerUser=asyncHandler(async (req,res)=>{
    const {fullname,email,username,password}=req.body;
    // console.log("req.body:" ,req.body);
    // if(fullname==="")throw ApiError(400,"fullname is required");
    if([fullname,email,username,password].some((field)=>{
        field?.trim()===""
    }))
    {
        throw new ApiError(400,"All fields are required");
    }
    // const existedUser=User.findOne({email})
    const existedUser=await User.findOne({
        $or :[{ username },{ email }]
    })

    // console.log("existed user ",existedUser)
    if(existedUser){
        throw new ApiError(409,"User with email or username already exist")
    }
    const avatarLocalPath=req.files?.avatar[0]?.path;//multer
    // const coverImageLocalPath=req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0)
    {
        coverImageLocalPath=req.files?.coverImage[0]?.path;
    }
    // console.log("req.files" ,req.files);
    if(!avatarLocalPath)
    {
        throw new ApiError(400,"Avatar file is required")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath);
    const  coverImage=await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar) throw new ApiError(400,"Avatar file is required");
    // console.log("avatar ",avatar);
    const user =await User.create({
        fullname,
        email,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        username:username.toLowerCase(),
        password,
    });
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user!!")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser, "User Registered Successfully")
    )
});

const loginUser=asyncHandler(async(req,res)=>{
    const {email,username,password}=req.body;
    if(!username && !email) throw new ApiError(400,"username or email is required");
    const user=await User.findOne(
        {
            $or: [{email},{username}]
        }
    );
    if(!password) throw new ApiError(400,"Password is required");
    if(!user) throw new ApiError(404,"User does not exist");
    const isPasswordValid=await user.isPasswordCorrect(password);
    if(!isPasswordValid) throw new ApiError(401,"Invalid User Credentials");

    const {accessToken,refreshToken}=await  generateAccessAndRefreshTokens(user._id);
    const loggedInUser=await User.findById(user._id).  //becoz we have saved refresh token but this user dont have becoz we have fetched it earlier
    select("-password -refreshToken");

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User Logged In Successfully"
        )
    )
     
});

const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1 //this will remove field from sdocument
            }
        },
        {
            new:true //abi jo y return krega to new data kre isliye lekin hme juarurat nhi hai isiliye nhi le rhe ahin user
        },
    )

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User LoggedOut Successfully"))
});

const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies?.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken) throw new ApiError(401,"unauthorized Request");
    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    
        const user=await User.findById(decodedToken?._id);
    
        if(!user) throw new ApiError(401 ,"Invalid Refresh Token");
    
        if(incomingRefreshToken !== user?.refreshToken)
        {
            throw new ApiError(401,"Refresh Token is Expired or used.")
        }
        const options={
            httpOnly:true,
            secure:true
        }
        const {refreshToken:newRefreshToken,accessToken}=await generateAccessAndRefreshTokens(user._id);
        // console.log("rf:" ,newRefreshToken," ac:",accessToken)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken" ,newRefreshToken,options)
        .json(
            new ApiResponse(200,
                {
                    accessToken,
                    refreshToken:newRefreshToken
                },
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh Token")
    }
});

const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body;

    const user=await User.findById(req.user._id);

    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect) throw new ApiError(400,"Invalid Old Password");

    user.password=newPassword;
    await user.save({validateBeforeSave:false});

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password Changed Successfully"))
});

const getCurrentUser=asyncHandler(async(req,res)=>{
    res.status(200)
    .json(new ApiResponse(200,req.user,"current user Fetched Successfully"));
});

const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullname,email}=req.body;
    if(!fullname || !email)
    {
        throw new ApiError(400,"All fields are required")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email:email,
            }
        },
        {
            new:true
        }
    ).select("-password");

    res
    .status(200)
    .json(new ApiResponse(200,user,"Account Details updated Successfully"));

});

const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path;
    // console.log(req.file);
    if(!avatarLocalPath) throw new ApiError(400,"Avatar file is missing");
    const avatar=await uploadOnCloudinary(avatarLocalPath);
    
    if(!avatar.url) throw new ApiError(400,"Error while uploading Avatar");
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password");

    return res 
    .status(200)
    .json(new ApiResponse(200,user,"Avatar changed Successfully"));
});

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path;
    // console.log(req.file);
    if(!coverImageLocalPath) throw new ApiError(400,"Cover Image file is missing");
    const coverImage=await uploadOnCloudinary(coverImageLocalPath);
    
    if(!coverImage.url) throw new ApiError(400,"Error while uploading cover Image");
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password");

    return res 
    .status(200)
    .json(new ApiResponse(200,user,"Cover Image changed Successfully"));
});

const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {username}=req.params;
    if(!username?.trim()) throw new ApiError(400,"Username is not found");

    const channel=await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase(),
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from :"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribeTo"
            }
        },
        {
            $addFields:{
                subscriberCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribeTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscribe"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscriberCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ]);
    // console.log(channel);
    if(!channel?.length)
    {
        throw new ApiError(404,"channel does not exists");

    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channel fetched successfully")
    )
});

const getWatchHistory=asyncHandler(async(req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"WatchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,
            user[0].getWatchHistory,"Watch History fetched successfully"
        )
    )
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};