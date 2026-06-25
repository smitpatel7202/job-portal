🧑‍💼 Job Portal – Full Stack Web Application

live on : https://job-1portal.netlify.app

A complete Job Portal Web Application where Job Seekers and Employers can register, log in, manage profiles, and securely upload/view resumes and company logos.

Built using Node.js, Express, MongoDB, HTML, CSS, JavaScript, and integrated with Cloudinary for file storage.

🚀 Features
👤 Authentication & Roles

User Registration & Login

Role-based access:

Job Seeker

Employer

Admin

JWT-based authentication

Protected API routes

📄 Resume & File Uploads

Job Seekers can upload resumes (PDF)

Employers can upload company logos

Files stored securely on Cloudinary

Resume access:

Job Seeker → own resume

Employer → job seekers’ resumes

Admin → all users

Download & inline preview supported

🧑‍💼 Job Seeker

Profile creation & completion tracking

Resume upload & update

View employer-posted jobs (future scope)

🏢 Employer

Employer profile management

View job seeker profiles

Access uploaded resumes securely

🛡️ Admin

Block / Unblock users

Platform monitoring controls

🛠 Tech Stack
Frontend

HTML5

CSS3

JavaScript (Vanilla JS)

Backend

Node.js

MongoDB (Atlas)

Mongoose

JWT Authentication

Multer

Cloudinary

Deployment

Frontend: Netlify

Backend: Render

Database: MongoDB Atlas

File Storage: Cloudinary

🔐 Environment Variables

Create a .env file inside backend/:

PORT=5000
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_jwt_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret


⚠️ Never commit .env to GitHub

▶️ Run Locally
1️⃣ Clone Repository
git clone https://github.com/your-username/job-portal.git
cd job-portal

2️⃣ Backend Setup
cd backend
npm install
npm start


Backend runs on:

http://localhost:5000

3️⃣ Frontend

Open frontend/index.html using:

Live Server (VS Code)
or

Any static server

🌐 Deployment Flow

Frontend deployed on Netlify

Backend API deployed on Render

MongoDB Atlas used for database

Cloudinary used for resumes & images

This ensures:

Secure file access

No server storage dependency

Scalable production setup

🔒 Security Highlights

JWT-protected routes

Role-based authorization

Resumes NOT publicly accessible

Cloudinary signed URLs (recommended)

Sensitive files excluded via .gitignore

📌 Future Improvements

Job posting & application system

Search & filter jobs

Email notifications

Resume analytics

Admin dashboard UI

👨‍💻 Author

Smit Patel
Full Stack Web Developer
Focused on Web Development + Backend + Real-world Projects
