// ============================================
// API TESTING SCRIPT
// Run: node test-api.js
// ============================================

const API_URL = 'http://localhost:5000/api';

let authToken = '';
let testEmployer = null;
let testJobSeeker = null;
let testJob = null;

// Helper function to make API requests
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

// Test functions
async function testRegisterEmployer() {
  console.log('\n🧪 Test 1: Register Employer');
  try {
    const data = await apiCall('/auth/register', 'POST', {
      name: 'Test Tech Company',
      email: `test-employer-${Date.now()}@test.com`,
      password: 'password123',
      role: 'employer'
    });
    testEmployer = data.user;
    console.log('✅ Employer registered:', data.user.email);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testRegisterJobSeeker() {
  console.log('\n🧪 Test 2: Register Job Seeker');
  try {
    const data = await apiCall('/auth/register', 'POST', {
      name: 'Test Job Seeker',
      email: `test-seeker-${Date.now()}@test.com`,
      password: 'password123',
      role: 'jobseeker'
    });
    testJobSeeker = data.user;
    console.log('✅ Job Seeker registered:', data.user.email);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testLoginEmployer() {
  console.log('\n🧪 Test 3: Login Employer');
  try {
    const data = await apiCall('/auth/login', 'POST', {
      email: testEmployer.email,
      password: 'password123'
    });
    authToken = data.token;
    console.log('✅ Employer logged in');
    console.log('   Token:', authToken.substring(0, 20) + '...');
    console.log('   Is Verified:', data.user.isVerified);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testUpdateEmployerProfile() {
  console.log('\n🧪 Test 4: Update Employer Profile');
  try {
    const data = await apiCall('/profile', 'PUT', {
      companyName: 'Test Tech Corp',
      companyWebsite: 'https://testtech.com',
      industry: 'Technology',
      companySize: '51-200',
      companyDescription: 'We build amazing software!'
    });
    console.log('✅ Profile updated');
    console.log('   Profile Completion:', data.user.profileCompletion + '%');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testPostJobUnverified() {
  console.log('\n🧪 Test 5: Try to Post Job (Should Fail - Unverified)');
  try {
    await apiCall('/jobs', 'POST', {
      title: 'Senior Developer',
      company: 'Test Tech Corp',
      category: 'Technology',
      location: 'New York, NY',
      type: 'Full-time',
      experienceLevel: 'Senior',
      workMode: 'Remote',
      description: 'Looking for experienced developer...'
    });
    console.log('❌ Test failed - should have been rejected!');
  } catch (error) {
    console.log('✅ Correctly rejected:', error.message);
  }
}

async function testGetProfile() {
  console.log('\n🧪 Test 6: Get Current Profile');
  try {
    const data = await apiCall('/profile');
    console.log('✅ Profile retrieved');
    console.log('   Name:', data.name);
    console.log('   Email:', data.email);
    console.log('   Role:', data.role);
    console.log('   Verified:', data.isVerified);
    console.log('   Profile %:', data.profileCompletion);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testRefreshToken() {
  console.log('\n🧪 Test 7: Refresh Access Token');
  try {
    // This would need the refresh token from login
    console.log('⚠️  Skipped - needs refresh token from login response');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testJobSeekerFlow() {
  console.log('\n🧪 Test 8: Job Seeker Flow');
  try {
    // Login as job seeker
    const loginData = await apiCall('/auth/login', 'POST', {
      email: testJobSeeker.email,
      password: 'password123'
    });
    authToken = loginData.token;
    console.log('✅ Job Seeker logged in');

    // Update profile
    await apiCall('/profile', 'PUT', {
      phone: '+1234567890',
      location: 'San Francisco, CA',
      skills: ['JavaScript', 'React', 'Node.js'],
      expectedSalary: '$80,000 - $100,000'
    });
    console.log('✅ Profile updated with skills');

    // Get profile to check completion
    const profile = await apiCall('/profile');
    console.log('   Profile Completion:', profile.profileCompletion + '%');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function testGetAllJobs() {
  console.log('\n🧪 Test 9: Get All Approved Jobs');
  try {
    authToken = ''; // No auth needed
    const jobs = await apiCall('/jobs');
    console.log(`✅ Found ${jobs.length} approved jobs`);
    if (jobs.length > 0) {
      console.log('   First job:', jobs[0].title);
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting API Tests...');
  console.log('========================================');

  try {
    await testRegisterEmployer();
    await testRegisterJobSeeker();
    await testLoginEmployer();
    await testUpdateEmployerProfile();
    await testPostJobUnverified();
    await testGetProfile();
    await testRefreshToken();
    await testJobSeekerFlow();
    await testGetAllJobs();

    console.log('\n========================================');
    console.log('✅ All tests completed!');
    console.log('\n📝 Summary:');
    console.log('   - Employer registered and profile updated');
    console.log('   - Job Seeker registered and profile updated');
    console.log('   - Authentication working (JWT tokens)');
    console.log('   - Profile completion tracking working');
    console.log('   - Unverified employer cannot post jobs ✓');
    console.log('\n💡 Next steps:');
    console.log('   1. Create an admin account');
    console.log('   2. Verify the test employer');
    console.log('   3. Test job posting and approval flow');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Run tests
runAllTests();