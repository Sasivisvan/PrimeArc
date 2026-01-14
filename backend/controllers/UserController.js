import user from "../models/User.js";


export const CreateUser = async(req,res)=>{
    try{
        const newUser = await user.create({name:"Sasi Visvan", email:"sasivisvan@gmail.com", role:"admin"});
        res.status(201).json(newUser);
    }catch(e){
        console.log("Error creating User",e);
        res.status(400).json({error: e.message});
    }
}

export const GetAllUsers = async(req,res)=>{
    try{
        const allUsers = await user.find({});
        res.status(201).json(allUsers);
    }catch(e){
        console.log("Error getting all Users",e);
        res.status(400).json({error: e.message});
    }
}