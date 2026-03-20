const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function verify() {
  const email = `teacher_${Date.now()}@test.com`;
  
  try {
    console.log(`🚀 Registering new teacher: ${email}`);
    
    const regRes = await post('http://localhost:5000/api/auth/register', {
      name: 'Test Teacher',
      email: email,
      password: 'password123',
      role: 'teacher',
      department: 'CS IoT'
    });

    if (regRes.data && regRes.data.success) {
      console.log('✅ Registration successful');
      const token = regRes.data.token;

      console.log('🔍 Fetching classes for new teacher...');
      const classRes = await get('http://localhost:5000/api/classes', token);

      if (classRes.data && classRes.data.success) {
        const classes = classRes.data.classes;
        console.log(`📊 Found ${classes.length} classes`);

        if (classes.length === 5) {
          console.log('✅ PASS: All 5 demo classes created successfully');
          classes.forEach((c, i) => {
            console.log(`   ${i + 1}. ${c.subject} (${c.subjectCode})`);
          });
        } else {
          console.log('❌ FAIL: Expected 5 classes, but found ' + classes.length);
        }
      } else {
        console.log('❌ FAIL: Could not fetch classes', classRes.data);
      }
    } else {
      console.log('❌ FAIL: Registration failed', regRes.data);
    }
  } catch (err) {
    console.error('❌ Error during verification:', err.message);
    console.log('\n💡 Tip: Make sure the backend server is running on port 5000!');
  }
}

verify();
