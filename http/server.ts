import express from "express";
import { LoginSchema, SignupSchema } from "./types";
import { UserModel } from "./schema";
import jwt from "jsonwebtoken";
const app = express();
const port = 3000;

app.use(express.json());

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
app.listen(port);