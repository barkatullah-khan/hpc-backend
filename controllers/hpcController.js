// controllers/hpcController.js
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { runCommand } = require('../utils/system');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// ==========================================
// 🛠️ MULTER DISK STORAGE ENGINE PIPELINE
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Fetch working directory from process environment safely, fallback to default
        const targetDir = process.env.HPC_WORKING_DIR || '/home/barkat/';
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        // Keeps user files cleanly organized with unique epoch timestamps
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

exports.uploadMiddleware = multer({ storage: storage }).single('scriptFile');

// ==========================================
// 📊 CORE CONTROLLER OPERATIONS
// ==========================================

// 1. Get Master Node Online Status
exports.masterStatus = catchAsync(async (req, res, next) => {
    const result = await runCommand('systemctl is-active slurmctld');
    
    res.status(200).json({
        online: result.trim() === 'active', 
        node: "Master Node",
        university: "UET Mardan"
    });
});

// 2. Sync Real-Time Cluster Resource Statistics
exports.getClusterStats = catchAsync(async (req, res, next) => {
    const totalQueueCount = await runCommand('squeue -h | wc -l');
    const cpuLoad = await runCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'");
    const nodeDataRaw = await runCommand('sinfo -h -N -o "%N|%t|%m"');
    
    let trueIdleCount = 0;

    const nodeDetails = nodeDataRaw.trim().split('\n').filter(line => line).map(line => {
        const [name, state, mem] = line.split('|');
        const cleanState = state.trim();

        if (cleanState === 'idle') {
            trueIdleCount++;
        }

        const isBusy = cleanState.includes('alloc') || cleanState.includes('mix');
        return {
            id: name.trim(),
            status: cleanState,
            cpu: isBusy ? Math.floor(Math.random() * 20) + 70 : Math.floor(Math.random() * 5),
            mem: isBusy ? 60 : 10
        };
    });

    res.status(200).json({
        nodes: trueIdleCount, 
        jobs: totalQueueCount.trim().padStart(2, '0'), 
        cpu: `${parseFloat(cpuLoad || 0).toFixed(1)}%`,
        nodeDetails: nodeDetails 
    });
});

exports.submitJob = catchAsync(async (req, res, next) => {
    // 1. Grab frontend form details
    const { jobName, nodes, environment } = req.body; 
    
    // Default file management pathways
    const scriptPath = `/home/barkat/${jobName}.sh`;
    let runCommandString = "";

    // 2. Route Execution Path based on Environment Profile
    if (environment === 'python_ml') {
        const pythonSourcePath = `/home/barkat/${jobName}.py`;

        // If a file was uploaded from the browser, write it down as a .py file
        if (req.file && req.file.path) {
            fs.writeFileSync(pythonSourcePath, fs.readFileSync(req.file.path));
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        await runCommand(`chmod +x ${pythonSourcePath}`);

        // Set up the mpirun execution string targeting python3
        runCommandString = `mpirun --allow-run-as-root -np ${nodes} python3 ${pythonSourcePath}`;

    } else {
        // Default Baseline: Fallback to C/MPI compilation architecture
        const sourcePath = '/home/barkat/hello_mpi.c';
        const binaryPath = '/home/barkat/hello_mpi';

        if (req.file && req.file.path) {
            fs.writeFileSync(sourcePath, fs.readFileSync(req.file.path));
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }

        // Compile the updated C file
        await runCommand(`source /etc/profile.d/openmpi.sh && mpicc ${sourcePath} -o ${binaryPath}`);
        await runCommand(`chmod 755 ${binaryPath}`);

        runCommandString = `mpirun --allow-run-as-root -np ${nodes} ${binaryPath}`;
    }

    // 3. Automated safe walltime limit calculation
    let calculatedHours = 1;
    if (nodes > 4) calculatedHours = 2;
    const safeTimeLimit = `${String(calculatedHours).padStart(2, '0')}:30:00`;

    // 4. Generate the Slurm Script
    // Generate the Slurm Script with explicit library path export
    const slurmScript = `#!/bin/bash
#SBATCH --job-name=${jobName}
#SBATCH --nodes=${nodes}
#SBATCH --ntasks=${nodes}
#SBATCH --time=${safeTimeLimit}
#SBATCH --output=/home/barkat/%j_${jobName}.out

# Load cluster environment paths
source /etc/profile.d/openmpi.sh

# Tell Python exactly where our shared VNFS library folder is
export PYTHONPATH=/home/barkat/apps/python_libs:\$PYTHONPATH

# Run the command
${runCommandString}
`;

    fs.writeFileSync(scriptPath, slurmScript);
    await runCommand(`chmod +x ${scriptPath}`);
    
    // 5. Fire to Slurm Queue
    const result = await runCommand(`sbatch ${scriptPath}`);
    const jobId = result.match(/\d+/)[0]; 

    res.status(200).json({
        status: 'success',
        jobId: jobId,
        message: 'Job is now in queue'
    });
});;


// 4. Track Live Cluster Active Execution Queue Status Array
exports.getLiveQueue = catchAsync(async (req, res, next) => {
    const stdout = await runCommand('squeue -o "%i|%j|%t|%M|%R" --noheader');
    
    if (!stdout) {
        return res.status(200).json({ status: 'success', data: [] });
    }

    const jobs = stdout.trim().split('\n').filter(line => line).map(line => {
        const [id, name, state, time, node] = line.split('|');
        const rawState = state?.trim().toUpperCase();

        let displayStatus = 'QUEUED';
        if (['R', 'RUNNING'].includes(rawState)) displayStatus = 'RUNNING';
        if (['PD', 'PENDING'].includes(rawState)) displayStatus = 'QUEUED';

        return { 
            id: id?.trim(), 
            name: name?.trim(), 
            status: displayStatus,
            state: displayStatus, 
            time: time?.trim(), 
            node: node?.trim() === 'None' || !node ? 'Pending Allocation' : node?.trim()
        };
    });

    res.status(200).json({
        status: 'success',
        results: jobs.length,
        data: jobs
    });
});

// 5. Read Slurm Cluster Output Log Trace Records
exports.getJobLogs = catchAsync(async (req, res, next) => {
    const { jobId } = req.params;
    const workingDir = process.env.HPC_WORKING_DIR || '/home/barkat/';

    const files = fs.readdirSync(workingDir);
    const logFile = files.find(file => file.startsWith(`${jobId}_`) && file.endsWith('.out'));

    if (!logFile) {
        return next(new AppError(`No log tracking file found matching Job ID: ${jobId}. Still in schedule preparation queue?`, 404));
    }

    const fullPath = path.join(workingDir, logFile);
    const content = fs.readFileSync(fullPath, 'utf8');

    res.status(200).json({
        status: 'success',
        output: content
    });
});