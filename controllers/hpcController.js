
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { runCommand } = require('../utils/system');


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