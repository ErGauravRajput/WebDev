import express from "express";

const app=express();
app.get("/api/src",(req,res)=>{
    res.send("hello")
});
app.listen(3000,()=>{
    console.log("server is running")
});