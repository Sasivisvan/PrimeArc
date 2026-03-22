import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';

const SigninPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // NOTICE: The 'async' keyword here allows us to use 'await' inside
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        
        try {
            // 3. The POST Request
            // 'await' pauses code here until the server replies
            const response = await fetch("http://localhost:5000/api/signin", {
            method: "POST",
            headers: {
                "Content-Type": "application/json", // Tells server we are sending JSON
            },
            body: JSON.stringify(formData), // Converts your JS object to a JSON string
        });
            
            const data = await response.json(); // Parse the server response
            
            if (!response.ok) {
                // If server sends 400/401/500 error, throw it to the catch block
                throw new Error(data.message || "Login failed");
            }
            
            // 4. Success Handling
            console.log("Login Successful:", data);
            
            // OPTIONAL: Store the token if your backend sends one (Standard practice)
            // localStorage.setItem('token', data.token);
            
            navigate("/dashboard");
        } catch (err: any) {
            // 5. Error Handling
            console.error("Login Error:", err);
            setError(err.message || "Something went wrong. Is the backend running?");
        } finally {
            // 6. Cleanup: Always runs, success or fail
            setIsLoading(false);
        }
    };

  return (
    // 1. Main Background: Deep dark color
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      
      {/* 2. Card Background: Slightly lighter dark for contrast */}
      <div className="w-full max-w-md space-y-8 bg-gray-800 p-8 shadow-2xl rounded-xl border border-gray-700">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Create Account
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Join us to get started
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
            {/* Name Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {/* Icon Color: Light gray */}
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                name="name"
                type="text"
                required
                // 3. Inputs: Dark background, light text, subtle border
                className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                placeholder="Full Name"
                onChange={handleChange}
              />
            </div>

            {/* Email Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                name="email"
                type="email"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                placeholder="Email address"
                onChange={handleChange}
              />
            </div>

            {/* Password Inputs */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                name="password"
                type="password"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                placeholder="Password"
                onChange={handleChange}
              />
            </div>
             <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                name="confirmPassword"
                type="password"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                placeholder="Confirm Password"
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create Account
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </form>

        <div className="text-center text-sm">
          <span className="text-gray-400">Already have an account? </span>
          <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SigninPage;