import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
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

export {registerUser};