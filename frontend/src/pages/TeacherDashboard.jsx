import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, AlertTriangle, BookOpen, Play, Edit3, Bluetooth, FileText, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import { AttendanceCircle, StatCard } from '../components/AttendanceStats';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getClasses,
  getClassAttendance,
  manualOverride,
  startSession,
  getEligibilityReport,
  getActiveDevices,
  getClassStudents
} from '../services/api';
import toast from 'react-hot-toast';

export default function TeacherDashboard() {

const { user } = useAuth();

const [classes,setClasses] = useState([]);
const [selectedClass,setSelectedClass] = useState(null);

const [attendanceData,setAttendanceData] = useState(null);
const [eligibilityReport,setEligibilityReport] = useState(null);
const [activeDevices,setActiveDevices] = useState([]);

const [loading,setLoading] = useState(false);
const [overrideModal,setOverrideModal] = useState(null);


/* LOAD CLASSES */

const loadClasses = async()=>{

try{

const res = await getClasses();

setClasses(res.data.classes);

if(!selectedClass && res.data.classes.length>0){
setSelectedClass(res.data.classes[0]);
}

}catch{

toast.error('Failed to load classes');

}

};


/* LOAD ATTENDANCE */

const loadAttendanceData = useCallback(async()=>{

if(!selectedClass) return;

setLoading(true);

try{

const [attRes,stdRes,eligRes] = await Promise.all([
getClassAttendance(selectedClass._id),
getClassStudents(selectedClass._id),
getEligibilityReport(selectedClass._id)
]);

const attendance = attRes.data;
const enrolledStudents = stdRes.data.students || [];
const statsRecords = attRes.data.records || [];
const report = eligRes.data;

const today = new Date();
today.setHours(0,0,0,0);

const studentStats = enrolledStudents.map(student=>{

const todayRecord = statsRecords.find(
r => r.student._id === student._id && new Date(r.date).getTime() >= today.getTime()
);

const overallStats = [...(report.eligible || []), ...(report.ineligible || [])].find(
r => r.student._id === student._id
);

return{
student,
present: overallStats?.present || 0,
total: overallStats?.total || 0,
percentage: overallStats?.percentage || 0,
todayStatus: todayRecord ? 'present' : 'absent'
};

});

setAttendanceData({
...attendance,
studentStats
});

setEligibilityReport(report);

}catch(err){

console.error(err);
toast.error('Failed to load attendance');

}finally{

setLoading(false);

}

},[selectedClass]);


/* LOAD ELIGIBILITY */

const loadEligibility = useCallback(async()=>{

if(!selectedClass) return;

try{

const res = await getEligibilityReport(selectedClass._id);
setEligibilityReport(res.data);

}catch{}

},[selectedClass]);


/* LOAD BLE DEVICES (only when class selected) */

const loadActiveDevices = useCallback(async()=>{

if(!selectedClass) return;

try{

const res = await getActiveDevices(selectedClass._id);
setActiveDevices(res.data.activeDevices || []);

}catch{}

},[selectedClass]);


/* INITIAL LOAD */

useEffect(()=>{
loadClasses();
},[]);


/* WHEN CLASS CHANGES */

useEffect(()=>{

if(selectedClass){

loadAttendanceData();
loadActiveDevices();

}

},[selectedClass]);


/* START SESSION */

const handleStartSession = async () => {

try{

await startSession({
classId:selectedClass._id
});

toast.success("Attendance session started");

await loadClasses();
loadAttendanceData();

}catch(err){

toast.error(err.response?.data?.message || "Failed to start session");

}

};


/* MANUAL OVERRIDE */

const handleManualOverride = async({studentId,status})=>{

try{

await manualOverride({
studentId,
classId:selectedClass._id,
status
});

toast.success('Attendance updated');

setOverrideModal(null);

loadAttendanceData();
loadEligibility();

}catch(err){

toast.error(err.response?.data?.message || 'Override failed');

}

};


/* DOWNLOAD PDF */

const handleDownloadPDF = () => {

if(!selectedClass || !attendanceData) return;

const doc = new jsPDF();

// Header
doc.setFontSize(18);
doc.text('Attendance Report', 14, 22);

doc.setFontSize(11);
doc.setTextColor(100);
doc.text(`Subject: ${selectedClass.subject} (${selectedClass.subjectCode})`, 14, 30);
doc.text(`Teacher: ${user?.name}`, 14, 36);
doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 42);

// Summary Table
autoTable(doc, {
startY: 50,
head: [['Metric', 'Value']],
body: [
['Total Students', totalStudents],
['Total Classes Held', attendanceData?.class?.totalClassesHeld || 0],
['Today\'s Attendance', todayPresent],
['Below 75% Threshold', belowThreshold]
],
theme: 'striped',
headStyles: { fillColor: [79, 70, 229] }
});

// Student Table
const tableData = filteredStudentStats.map(s => [
s.student.name,
s.student.rollNumber,
s.todayStatus === 'present' ? 'Present' : 'Absent',
`${s.percentage}% (${s.present}/${s.total})`
]);

autoTable(doc, {
startY: doc.lastAutoTable.finalY + 10,
head: [['Student Name', 'Roll Number', 'Today', 'Overall Attendance']],
body: tableData,
theme: 'grid',
headStyles: { fillColor: [79, 70, 229] }
});

doc.save(`${selectedClass.subjectCode}_Attendance_Report.pdf`);

toast.success("PDF Report Generated");

};


const filteredStudentStats =
attendanceData?.studentStats || [];

const todayPresent =
filteredStudentStats.filter(
s => s.todayStatus==='present'
).length;

const totalStudents =
filteredStudentStats.length;

const belowThreshold =
eligibilityReport?.ineligible?.length || 0;



return(

<div className="min-h-screen bg-gray-50">

<Navbar/>

<div className="max-w-7xl mx-auto px-4 py-6">


{/* HEADER */}

<div className="flex items-center justify-between mb-6">

<div>

<h1 className="text-2xl font-bold text-gray-900">
Teacher Dashboard
</h1>

<p className="text-gray-500 text-sm">
Welcome, {user?.name}
</p>

</div>

<div className="flex gap-2">

{selectedClass && (
<button
onClick={handleDownloadPDF}
className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50 shadow-sm"
>
<FileText className="w-4 h-4 text-orange-500" />
Download Report
</button>
)}

{selectedClass && (

<button
type="button"
onClick={handleStartSession}
disabled={selectedClass?.attendanceActive}
className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm ${
selectedClass?.attendanceActive
? 'bg-green-100 text-green-700'
: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
}`}
>

<Play className="w-4 h-4"/>

{selectedClass?.attendanceActive
? 'Session Active'
: 'Start Session'}

</button>

)}
</div>

</div>


{/* MAIN GRID */}

<div className="grid lg:grid-cols-4 gap-6">


{/* CLASS LIST */}

<div className="lg:col-span-1">

<div className="card">

<h3 className="font-semibold mb-3 flex items-center gap-2">

<BookOpen className="w-4 h-4 text-purple-600"/>

My Classes

</h3>

{classes.map(cls=>(

<button
type="button"
key={cls._id}
onClick={()=>setSelectedClass(cls)}
className={`w-full text-left p-3 rounded-lg border-2 mb-2 ${
selectedClass?._id===cls._id
? 'border-purple-500 bg-purple-50'
: 'border-gray-200'
}`}
>

<div className="font-medium text-sm">{cls.subject}</div>

<div className="text-xs text-gray-500">{cls.subjectCode}</div>

</button>

))}

</div>


{/* BLE DEVICES */}

<div className="card mt-4">

<h3 className="font-semibold mb-2 flex items-center gap-2">

<Bluetooth className="w-4 h-4 text-blue-600"/>

Detected Devices

</h3>

{activeDevices.length === 0 ? (

<p className="text-xs text-gray-400">

No BLE devices detected

</p>

) : (

activeDevices.map((d,i)=>(

<div key={i} className="text-xs text-gray-700">

{d.student?.name || 'Unknown'} ({d.rssi} dBm)

</div>

))

)}

</div>

</div>


{/* MAIN PANEL */}

<div className="lg:col-span-3">

{selectedClass && (

<>

{/* STATS */}

<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

<StatCard label="Today Present" value={todayPresent} icon={CheckCircle} color="green"/>
<StatCard label="Total Students" value={totalStudents} icon={Users} color="blue"/>
<StatCard label="Below 75%" value={belowThreshold} icon={AlertTriangle} color="yellow"/>
<StatCard label="Classes Held" value={attendanceData?.class?.totalClassesHeld || 0} icon={BookOpen} color="purple"/>

</div>


{/* STUDENT TABLE */}

<div className="card">

<h3 className="font-bold mb-4">
Student Attendance
</h3>

{loading ? (

<div className="text-center py-6 text-gray-400">
Loading...
</div>

) : (

<div className="overflow-x-auto">

<table className="w-full text-sm">

<thead>

<tr className="border-b text-left text-gray-500">
<th className="pb-2 pr-4">Student</th>
<th className="pb-2 pr-4">Roll</th>
<th className="pb-2 pr-4">Today</th>
<th className="pb-2 pr-4">Overall</th>
<th className="pb-2">Action</th>
</tr>

</thead>

<tbody className="divide-y divide-gray-100">

{filteredStudentStats.map((s,i)=>(

<tr key={i} className="hover:bg-gray-50">

<td className="py-3 pr-4 font-medium">{s.student.name}</td>

<td className="py-3 pr-4 text-xs text-gray-500">{s.student.rollNumber}</td>

<td className="py-3 pr-4">
{s.todayStatus==='present' ? 'Present' : 'Absent'}
</td>

<td className="py-3 pr-4">
<div className="flex items-center gap-2">
<AttendanceCircle percentage={s.percentage}/>
<div className="text-[10px] text-gray-400 whitespace-nowrap">
{s.present}/{s.total} classes
</div>
</div>
</td>

<td>

<button
type="button"
onClick={()=>setOverrideModal(s.student)}
className="text-gray-400 hover:text-blue-600"
>
<Edit3 className="w-4 h-4"/>
</button>

</td>

</tr>

))}

</tbody>

</table>

</div>

)}

</div>

</>

)}

</div>

</div>


{/* MANUAL OVERRIDE MODAL */}

{overrideModal && (

<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">

<div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">

<div className="flex items-center justify-between mb-6">

<div>
<h2 className="text-lg font-bold">Manual Override</h2>
<p className="text-sm text-gray-500">{overrideModal.name} • {overrideModal.rollNumber}</p>
</div>

<button 
onClick={() => setOverrideModal(null)}
className="p-2 hover:bg-gray-100 rounded-full transition-colors"
>
<X className="w-5 h-5 text-gray-400" />
</button>

</div>

<p className="text-sm text-gray-600 mb-6">
Select the attendance status for today's session. This will override any automatic beacon detection.
</p>

<div className="grid grid-cols-2 gap-4">

<button
onClick={() => handleManualOverride({ studentId: overrideModal._id, status: 'present' })}
className="py-4 rounded-xl border-2 border-green-100 bg-green-50 text-green-700 font-bold hover:border-green-500 transition-all flex flex-col items-center gap-2"
>
<CheckCircle className="w-6 h-6" />
Mark Present
</button>

<button
onClick={() => handleManualOverride({ studentId: overrideModal._id, status: 'absent' })}
className="py-4 rounded-xl border-2 border-red-100 bg-red-50 text-red-700 font-bold hover:border-red-500 transition-all flex flex-col items-center gap-2"
>
<X className="w-6 h-6" />
Mark Absent
</button>

</div>

<button
onClick={() => setOverrideModal(null)}
className="w-full mt-6 py-3 text-gray-500 font-medium hover:text-gray-700"
>
Cancel
</button>

</div>

</div>

)}

</div>

</div>

);

}