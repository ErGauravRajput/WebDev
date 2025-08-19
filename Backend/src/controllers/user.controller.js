import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens=async(userid)=>{
    const user=await User.findById(userid);
    const accessToken=user.generateAccessToken();
    const refreshToken=user.generateRefreshToken();
    user.refreshToken=refreshToken;
    await user.save({validateBeforeSave:false});
    return {accessToken,refreshToken};

}

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
    if(!user) throw new ApiError(404,"User does not exist");
    const isPasswordValid=user.isPasswordCorrect(password);
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
     
})

const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
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
})
export {
    registerUser,
    loginUser,
    logoutUser
};