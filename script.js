// State
let subjects = [];
try {
    const parsed = JSON.parse(localStorage.getItem('ssp_v2_subjects'));
    if (Array.isArray(parsed)) {
        // Ensure legacy objects are filtered or adapted, but here we just reset if missing priority
        subjects = parsed.filter(s => s && typeof s.priority === 'number');
    }
} catch (e) {}

let totalHours = 8;
try {
    const storedHours = localStorage.getItem('ssp_v2_totalHours');
    if (storedHours) {
        totalHours = parseFloat(storedHours);
        if (isNaN(totalHours) || totalHours <= 0) totalHours = 8;
    }
} catch (e) {}

let chartInstance = null;

// DOM Elements
const totalHoursInput = document.getElementById('totalHours');
const addSubjectForm = document.getElementById('addSubjectForm');
const subjectNameInput = document.getElementById('subjectName');
const subjectPriorityInput = document.getElementById('subjectPriority');
const subjectList = document.getElementById('subjectList');
const totalAllocatedHoursDisplay = document.getElementById('totalAllocatedHours');
const chartCanvas = document.getElementById('studyChart');
const emptyChartMessage = document.getElementById('emptyChartMessage');

// Priority Names and Colors
const priorityMeta = {
    3: { name: 'High', color: '#ec4899', gradient: ['#ec4899', '#db2777'] }, // Pink
    2: { name: 'Medium', color: '#a855f7', gradient: ['#a855f7', '#9333ea'] }, // Purple
    1: { name: 'Low', color: '#3b82f6', gradient: ['#3b82f6', '#2563eb'] } // Blue
};

// Initialize
function init() {
    totalHoursInput.value = totalHours;
    
    // Event Listeners
    totalHoursInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 1;
        totalHours = val;
        saveState();
        render();
    });

    addSubjectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addSubject();
    });

    // Initialize Clock
    setInterval(updateClock, 1000);
    updateClock();

    // Initial render
    render();
}

// Logic: Calculate allocated time per subject
function calculateAllocation() {
    const totalWeight = subjects.reduce((sum, sub) => sum + sub.priority, 0);
    
    return subjects.map(sub => {
        const allocatedHours = totalWeight === 0 ? 0 : (sub.priority / totalWeight) * totalHours;
        return {
            ...sub,
            allocatedHours: allocatedHours
        };
    });
}

// CRUD Operations
function addSubject() {
    const name = subjectNameInput.value.trim();
    const priority = parseInt(subjectPriorityInput.value);

    if (name === '') return;

    const newSubject = {
        id: Date.now().toString(),
        name,
        priority
    };

    subjects.push(newSubject);
    subjectNameInput.value = '';
    
    saveState();
    render();
}

function deleteSubject(id) {
    subjects = subjects.filter(sub => sub.id !== id);
    saveState();
    render();
}

// Attach to window so HTML string onclick works
window.deleteSubject = deleteSubject;

function saveState() {
    localStorage.setItem('ssp_v2_subjects', JSON.stringify(subjects));
    localStorage.setItem('ssp_v2_totalHours', totalHours.toString());
}

// UI Rendering
function render() {
    const allocatedSubjects = calculateAllocation();
    renderList(allocatedSubjects);
    renderChart(allocatedSubjects);
    
    // Update summary text
    const allocatedSum = allocatedSubjects.reduce((sum, sub) => sum + sub.allocatedHours, 0);
    totalAllocatedHoursDisplay.textContent = `${allocatedSum.toFixed(1)} / ${totalHours} hrs`;
}

function renderList(allocatedSubjects) {
    subjectList.innerHTML = '';
    
    if (allocatedSubjects.length === 0) {
        subjectList.innerHTML = `
            <div class="text-center py-6 text-indigo-300 text-sm italic">
                No subjects added yet. Start by adding one!
            </div>
        `;
        return;
    }

    allocatedSubjects.forEach(sub => {
        const pMeta = priorityMeta[sub.priority];
        const hoursStr = sub.allocatedHours.toFixed(1) + ' hrs';
        const minsStr = Math.round(sub.allocatedHours * 60) + ' min';
        
        const el = document.createElement('div');
        el.className = 'group flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300';
        
        el.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="w-3 h-3 rounded-full" style="background-color: ${pMeta.color}; box-shadow: 0 0 10px ${pMeta.color}"></div>
                <div>
                    <h3 class="font-medium text-white">${sub.name}</h3>
                    <div class="flex items-center space-x-2 text-xs mt-1">
                        <span class="text-indigo-200 opacity-80">${pMeta.name} Priority</span>
                        <span class="text-white/30">•</span>
                        <span class="text-cyan-300 font-semibold">${hoursStr}</span>
                        <span class="text-indigo-300">(${minsStr})</span>
                    </div>
                </div>
            </div>
            <button onclick="window.deleteSubject('${sub.id}')" class="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white transition-colors opacity-50 group-hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
        `;
        subjectList.appendChild(el);
    });
}

function renderChart(allocatedSubjects) {
    if (allocatedSubjects.length === 0) {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        chartCanvas.style.display = 'none';
        emptyChartMessage.style.display = 'flex';
        return;
    }

    chartCanvas.style.display = 'block';
    emptyChartMessage.style.display = 'none';

    const labels = allocatedSubjects.map(sub => sub.name);
    const data = allocatedSubjects.map(sub => sub.allocatedHours);
    const bgColors = allocatedSubjects.map(sub => priorityMeta[sub.priority].color);

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = data;
        chartInstance.data.datasets[0].backgroundColor = bgColors;
        chartInstance.update();
    } else {
        Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
        Chart.defaults.font.family = "'Inter', sans-serif";
        
        const ctx = chartCanvas.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Allocated Hours',
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 20
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            padding: 20,
                            font: {
                                size: 12
                            },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed.toFixed(1) + ' hrs';
                                }
                                return label;
                            }
                        }
                    }
                },
                cutout: '70%',
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }
}

// Clock Functionality
function updateClock() {
    const clockElement = document.getElementById('digitalClock');
    if (!clockElement) return;
    
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    
    clockElement.textContent = `${hours}:${minutes}:${seconds} ${ampm}`;
}

// Start app
document.addEventListener('DOMContentLoaded', init);
