import mongoose from "mongoose"

const UserSchema = new mongoose.Schema({
    name:{type:String, require:true},
    email:{type:String, require:true},
    role:{type:String, default:"student"}
});

export default mongoose.model("User", UserSchema);