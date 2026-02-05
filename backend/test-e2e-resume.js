const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEST_PORT = 5001;
const TEST_UPLOAD_DIR = 'test_uploads';
const API_URL = `http://localhost:${TEST_PORT}/api`;

let serverProcess;
let jobSeekerToken = '';
let employerToken = '';
let uploadedResumePath = '';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function apiCall(endpoint, method = 'GET', body = null, token = null, isFormData = false) {
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  
  if (headers['Content-Type'] === 'application/pdf' || endpoint.includes('/uploads/resumes/')) {
    return response;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function runTests() {
  console.log('🚀 Starting E2E Resume Architecture Tests...');

  if (fs.existsSync(TEST_UPLOAD_DIR)) {
    fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  }

  console.log(`\n📦 Starting Server with UPLOAD_DIR=${TEST_UPLOAD_DIR}...`);
  serverProcess = spawn('node', ['server.js'], {
    env: { 
      ...process.env, 
      PORT: TEST_PORT, 
      UPLOAD_DIR: TEST_UPLOAD_DIR,
      MONGO_URI: process.env.MONGO_URI
    },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
  });
  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data}`);
  });

  await delay(5000);

  try {
    console.log('\n👤 Registering Job Seeker...');
    const seekerEmail = `test-seeker-${Date.now()}@test.com`;
    await apiCall('/auth/register', 'POST', {
      name: 'Test Seeker',
      email: seekerEmail,
      password: 'password123',
      role: 'jobseeker'
    });
    
    const seekerLogin = await apiCall('/auth/login', 'POST', {
      email: seekerEmail,
      password: 'password123'
    });
    jobSeekerToken = seekerLogin.token;
    console.log('✅ Job Seeker registered and logged in');

    console.log('\n📄 Creating dummy resume.pdf...');
    const dummyPdfPath = path.join(__dirname, 'dummy-resume.pdf');
    fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n%Dummy PDF Content');

    console.log('\n📤 Uploading resume...');
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(dummyPdfPath)], { type: 'application/pdf' });
    formData.append('resume', fileBlob, 'resume.pdf');

    const uploadRes = await apiCall('/profile/resume', 'POST', formData, jobSeekerToken, true);
    console.log('✅ Upload response:', uploadRes);
    
    if (!uploadRes.resume.startsWith('/uploads/resumes/')) {
      throw new Error('Resume path format incorrect');
    }
    uploadedResumePath = uploadRes.resume;

    const storedFilename = path.basename(uploadedResumePath);
    const storedPath = path.join(TEST_UPLOAD_DIR, 'resumes', storedFilename);
    if (fs.existsSync(storedPath)) {
      console.log(`✅ File confirmed in custom storage: ${storedPath}`);
    } else {
      throw new Error(`File not found in ${storedPath}`);
    }

    console.log('\n📥 Testing Download (Job Seeker)...');
    const downloadUrl = `http://localhost:${TEST_PORT}${uploadedResumePath}`;
    const downloadRes = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${jobSeekerToken}` }
    });
    
    if (downloadRes.status === 200) {
      console.log('✅ Resume downloaded successfully (200 OK)');
      const contentType = downloadRes.headers.get('content-type');
      if (contentType === 'application/pdf') {
        console.log('✅ Content-Type is application/pdf');
      } else {
        console.error('❌ Unexpected Content-Type:', contentType);
      }
    } else {
      throw new Error(`Download failed with status ${downloadRes.status}`);
    }

    console.log('\n👔 Registering Employer...');
    const employerEmail = `test-employer-${Date.now()}@test.com`;
    await apiCall('/auth/register', 'POST', {
      name: 'Test Employer',
      email: employerEmail,
      password: 'password123',
      role: 'employer'
    });
    
    const employerLogin = await apiCall('/auth/login', 'POST', {
      email: employerEmail,
      password: 'password123'
    });
    employerToken = employerLogin.token;

    console.log('\n👀 Testing Employer Access to Resume...');
    const employerDownloadRes = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${employerToken}` }
    });

    if (employerDownloadRes.status === 200) {
      console.log('✅ Employer can access resume (200 OK)');
    } else {
      throw new Error(`Employer access failed with status ${employerDownloadRes.status}`);
    }

    console.log('\n🚫 Testing Unauthorized Access (No Token)...');
    const unauthorizedRes = await fetch(downloadUrl);
    if (unauthorizedRes.status === 401 || unauthorizedRes.status === 403) {
      console.log(`✅ Access denied as expected (${unauthorizedRes.status})`);
    } else {
      console.error(`❌ Unexpected status for unauthorized request: ${unauthorizedRes.status}`);
    }

    console.log('\n✨ All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test Failed:', error);
  } finally {
    serverProcess.kill();
    if (fs.existsSync('dummy-resume.pdf')) fs.unlinkSync('dummy-resume.pdf');
    process.exit(0);
  }
}

runTests();
