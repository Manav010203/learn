import express from "express";
import {  AddStudentSchema, AttendanceStartSchema, CreateClassSchema, LoginSchema, SignupSchema } from "./types";
import { AttendanceModel, ClassModel, UserModel } from "./schema";
import jwt from "jsonwebtoken";
import { authMiddleware, teacherRoleMiddleware } from "./middleware";
import mongoose from "mongoose";
const app = express();
const port = 3000;

app.use(express.json());

let actvieSessions : {classId:string, startedAt:Date,attendance: Record<string,string>}|null =null;

app.post("/auth/signup",async (req,res)=>{
    const {success, data} = SignupSchema.safeParse(req.body);

    if(!success){
        res.status(400).json({
            "success":false,
            "error":"Invalid request schema",
        })
        return;
    }
    const user = await UserModel.findOne({
        email:data.email
    })
    if(user){
        res.status(400).json({
            "success":false,
            "error":"Email already exists"
        })
        return;
    }
    const userCreate = await UserModel.create({
        email:data.email,
        password:data.password,
        name:data.name,
        role:data.role,
    })
    res.status(201).json({
        success:true,
        data:{
            _id:userCreate.id,
            name:userCreate.name,
            email:userCreate.email,
            role:userCreate.role,
        }
    })
})
app.post("/auth/login",async(req,res)=>{
    const {success,data}= LoginSchema.safeParse(req.body);
    if(!success){
        res.status(400).json({
            "success":false,
            "error":"Invalid request schema"
        })
        return;
    }

    const user =await UserModel.findOne({
        email:data.email
    })
    if(!user || user.password != data.password){
        res.status(400).json({
            "success":false,
            "error":"Invalid email or password"
        })
        return;
    }
    const token = jwt.sign({
        role:user.role,
        userId:user._id
    },process.env.JWT_PASSWORD!);
    res.status(200).json({
        "success":true,
        "data": {
            "token":token
        }
    })
})
app.get("/auth/me",authMiddleware,async(req,res)=>{
    const user = await UserModel.findOne({
        _id:req.userId
    })
    if(!user){
        res.status(400).json({
            message:"control shouldnt reach here"
        })
        return;
    }
    res.status(200).json({
        "success":true,
        "data":{
            "_id":user._id,
            "name":user.name,
            "email":user.email,
            "role":user.role
        }
    })
})
app.post("/class",authMiddleware,teacherRoleMiddleware,async(req,res)=>{
    const {success,data} = CreateClassSchema.safeParse(req.body);
    if(!success){
        res.status(400).json({
            "success":false,
            "error":"Invalid request schema"
        })
        return;
    }
    const classroom =await ClassModel.create({
        className:data.className,
        teacherId:req.userId,
        studentIds:[]
    })
    res.status(201).json({
        "success":true,
        "data":{
            "_id":classroom._id,
            "className":classroom.className,
            "teacherId":classroom.teacherId,
            "studentIds":classroom.studentIds
        }
    })
})
app.post("/class/:id/add-student",authMiddleware,teacherRoleMiddleware,async(req,res)=>{
    const {success,data} = await AddStudentSchema.safeParse(req.body);
    if(!success){
        res.status(400).json({
            "success":false,
            "error":"Invalid request schema"
        })
        return;
    }
    const studentId = data.studentId;
    const classRoom = await ClassModel.findOne({
        _id:req.params._id
    })
    if(!classRoom){
        res.status(404).json({
        "success": false,
        "error": "Class not found"
    })
    return;
    }
    if(classRoom.teacherId !== req.userId) {
        res.status(403).json({
            "success":false,
            "error":"Forbidden, not class teacher"
        })
        return;
    }
    const user = await UserModel.findOne({
        _id:studentId
    })
    if(!user){
        res.status(404).json({
        "success": false,
        "error": "Student not found"
    })
    return;
    }
    //Concurrency issue check
    classRoom.studentIds.push(new mongoose.Types.ObjectId(studentId));
    await classRoom.save();

    res.status(200).json({
        "success":true,
        "data":{
            "_id":classRoom._id,
            "className":classRoom.className,
            "teacherId":classRoom.teacherId,
            "studentIds":classRoom.studentIds
        }
    })
})
app.get("/class/:id",authMiddleware,async(req,res)=>{
    const classRoom = await ClassModel.findOne({
        _id:req.params._id
    })
    if(!classRoom){
        res.status(404).json({
            "success":false,
            "error":"Class not found"
        })
        return;
    }
    if(classRoom.teacherId === req.userId || classRoom.studentIds.map(x=>x.toString()).includes(req.userId!)){
        const students = await UserModel.find({
            _id:classRoom.studentIds
        })
        res.status(200).json({
            "success":true,
            "data":{
                "_id":classRoom._id,
                "className":classRoom.className,
                "teacherId":classRoom.teacherId,
                "students": students.map(s=>({
                    _id:s._id,
                    name:s.name,
                    email:s.email
                })
                )
            }
        })
    }
    else{
        res.status(404).json({
            "success":false,
            "error":"Forbidden"
        })
    }


})
app.get("students",authMiddleware,teacherRoleMiddleware,async(req,res)=>{
    const students = await UserModel.find({
        role:"student"
    })
    res.status(200).json({
        "success":true,
        "data":students.map(s=>({
            _id:s._id,
            name:s.name,
            email:s.email
        }))
    })
})
app.get("/class/:id/my-attendance",authMiddleware,async(req,res)=>{
    const classId = req.params._id;
    const userId = req.userId;
    const classRoom = await ClassModel.findOne({
        _id:classId
    })
    if(!classRoom){
        res.status(403).json({
            "success":false,
            "error":"Class not found"
        })
        return;
    }
    const attendance = await AttendanceModel.findOne({
        classId:classId,
        studentid:userId
    })
    if(attendance){
        res.status(200).json({
            "success":true,
            "data":{
                "classId":classId,
                "status":"present"
            }
        })
        return;
    }else{
        res.status(200).json({
            "success":true,
            "data":{
                "classId":classId,
                "status":null
            }
        })
        return;
    }
})
app.get("/attendance/start",authMiddleware,teacherRoleMiddleware,async(req,res)=>{
    const {success,data} = AttendanceStartSchema.safeParse(req.body);
    if(!success){
        res.status(400).json({
            "success":false,
            "error":"Invalid request schema"
        })
        return;
    }
    const classRoom = await ClassModel.findOne({
        _id:data.classId
    })
    if(!classRoom || classRoom.teacherId !== req.userId){
        res.status(401).json({
            "success":false,
            "error":"forbidden, not class teacher"
        })
        return;
    }
    actvieSessions = {
        classId:classRoom._id.toString(),
        startedAt:new Date(),
        attendance:{}
    }
    res.status(200).json({
        "success":true,
        "data":{
            "classId":classRoom._id,
            "startedAt":actvieSessions.startedAt
        }
    })

})
app.listen(port);