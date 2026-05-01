
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { runCommand } = require('../utils/system');
const fs = require('fs');
const path = require('path');


exports.masterStatus = catchAsync(async (req, res, next) => {
    const result = await runCommand('systemctl is-active slurmctld');
    
    res.status(200).json({
        online: result.trim() === 'active', 
        node: "Master Node",
        university: "UET Mardan"
    });
});

exports.getClusterStats = catchAsync(async (req, res, next) => {
    const totalNodes = await runCommand('sinfo -h -N | wc -l');
    const activeNodes = await runCommand('sinfo -h -N -t idle,alloc | wc -l');
    const runningJobs = await runCommand('squeue -h -t R | wc -l');
    const cpuLoad = await runCommand("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'");
    const memInfo = await runCommand("free -g | grep Mem | awk '{print $3 \" / \" $2 \" GB\"}'");

    if (!totalNodes) {
        return next(new AppError('Could not connect to SLURM controller', 500));
    }

    res.status(200).json({
        nodes: `${activeNodes.trim()} / ${totalNodes.trim()}`,
        jobs: runningJobs.trim().padStart(2, '0'),
        cpu: `${parseFloat(cpuLoad || 0).toFixed(1)}%`,
        memory: memInfo.trim() || "N/A"
    });
});

exports.submitJob = catchAsync(async (req, res, next) => {
    const { jobName, nodes, timeLimit } = req.body;

    // Define the path within your NFS shared directory
    const fileName = `${jobName}.sh`;
    const filePath = path.join('/home/barkat', fileName);

    // This is the SLURM template
    const slurmScript = `#!/bin/bash
#SBATCH --job-name=${jobName}
#SBATCH --nodes=${nodes}
#SBATCH --time=${timeLimit}:00:00
#SBATCH --output=/home/barkat/%j_${jobName}.out

echo "Execution started on: $(hostname)"
echo "Shared directory: /home/barkat"
sleep 60
echo "Execution finished."
`;

    // 1. Write the file to the NFS share
    fs.writeFileSync(filePath, slurmScript);
    
    // 2. Grant execution permissions (important for SLURM)
    await runCommand(`chmod +x ${filePath}`);

    // 3. Submit to the SLURM queue
    const result = await runCommand(`sbatch ${filePath}`);

    res.status(200).json({
        status: 'success',
        message: 'Job submitted to cluster',
        details: result // Returns "Submitted batch job XXXX"
    });
});


// This function gets the "Live" queue data
exports.getLiveQueue = catchAsync(async (req, res, next) => {
    // 1. Run the command using your existing utility
    const stdout = await runCommand('squeue -o "%i|%j|%t|%M|%R" --noheader');
    
    // 2. Error Handling: If Slurm is down or command fails
    if (stdout === null || stdout === undefined) {
        return next(new AppError('Unable to fetch queue from SLURM', 500));
    }

    // 3. Parse the data
    const jobs = stdout.trim().split('\n').filter(line => line).map(line => {
        const [id, name, state, time, node] = line.split('|');
        return { 
            id: id?.trim(), 
            name: name?.trim(), 
            state: state?.trim(), 
            time: time?.trim(), 
            node: node?.trim() 
        };
    });

    // 4. Send clean JSON back to React
    res.status(200).json({
        status: 'success',
        results: jobs.length,
        data: jobs
    });
});