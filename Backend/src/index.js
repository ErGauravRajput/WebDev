// require('dotenv').config({path:'./env'})
import dotenv from "dotenv";//-r dotenv/config --experimental-json-modules only for this import if uper require then no need
import connectDB from "./db/db.js";
import { app } from "./app.js";
dotenv.config({
    path:'./.env'
})
connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running at port: ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("Mongo db connection failed !!",err);
})
































/*
const app=express();
(async()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error",(error)=>{
            console.log(error);
            throw error;
        })
        app.listen(process.env.PORT,()=>{
            console.log("server is running")
        });
    } catch (error) {
        console.error(error);
        throw error
    }
})()*/
