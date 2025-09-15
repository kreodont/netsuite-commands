/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @NName MapReduce Status Monitor
 * @NDescription Real-time monitoring of MapReduce command execution status
 * @NDeploy 1
 */

import { EntryPoints } from "N/types";
import * as serverWidget from "N/ui/serverWidget";


export function onRequest(context: EntryPoints.Suitelet.onRequestContext) {
    const { request, response } = context;
    
    if (request.method === 'GET') {
        // Get jobId parameter if provided
        const jobId = request.parameters.jobId as string || null;
        showStatusPage(response, jobId);
    }
}

function showStatusPage(response: EntryPoints.Suitelet.onRequestContext['response'], jobId: string | null) {
    const title = jobId ? `MapReduce Status: ${jobId}` : 'MapReduce Command Execution Status';
    const form = serverWidget.createForm({
        title: title
    });
    
    
    // Add hidden field for jobId if provided
    if (jobId) {
        const jobIdField = form.addField({
            id: 'custpage_job_id',
            type: serverWidget.FieldType.TEXT,
            label: 'Job ID'
        });
        jobIdField.updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN
        });
        jobIdField.defaultValue = jobId;
        
    }
    
    
    // Add status container
    form.addField({
        id: 'custpage_status_html',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Status Display'
    }).defaultValue = generateStatusHTML();
    
    // Add inline JavaScript for auto-refresh
    form.addField({
        id: 'custpage_refresh_script',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Refresh Script'
    }).defaultValue = `
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            let refreshInterval = null;
            const statusContainer = document.getElementById('mapreduce_status_container');
            
            // Capture jobId after DOM is loaded
            const jobIdField = document.getElementById('custpage_job_id');
            
            
            let jobId = jobIdField ? jobIdField.value : null;
            
            // Fix: Convert string "null" to actual null
            if (jobId === "null" || jobId === "") {
                jobId = null;
            }
            
            function fetchStatusCore() {
                // Use the jobId captured at script initialization
                
                // Build the restlet URL with optional jobId parameter  
                let restletUrl = '/app/site/hosting/restlet.nl?script=customscript_rl_rest_mr_status&deploy=customdeploy_rl_rest_mr_status1';
                if (jobId) {
                    restletUrl += '&jobId=' + encodeURIComponent(jobId);
                }
                
                fetch(restletUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin'
                })
                .then(response => response.json())
                .then(data => {
                    updateStatusDisplay(data);
                })
                .catch(error => {
                    updateStatusDisplay({
                        jobs: [],
                        timestamp: new Date().toISOString(),
                        error: 'Failed to fetch status: ' + error.message
                    });
                });
            }
            
            
            function updateStatusDisplay(statusData) {
                const container = document.getElementById('mapreduce_status_container');
                if (!container) return;
                
                let html = '<div class="status-grid">';
                
                // Handle error case
                if (statusData.error) {
                    html += '<div class="error-message">Error: ' + statusData.error + '</div>';
                } else if (statusData.jobs && statusData.jobs.length > 0) {
                    statusData.jobs.forEach(job => {
                        // Default to group-based progress if no command details available yet
                        let progressPercent = job.totalRecords > 0 
                            ? Math.round((job.processedRecords / job.totalRecords) * 100) 
                            : 0;
                        
                        html += '<div class="job-card">' +
                            '<div class="job-header">' +
                                '<h3>' + job.jobId + '</h3>' +
                                '<span class="job-status status-' + job.status.toLowerCase() + '">' + job.status + '</span>' +
                            '</div>' +
                            '<div class="job-details">' +
                                '<div class="detail-row">' +
                                    '<span>Stage:</span>' +
                                    '<span>' + job.stage + '</span>' +
                                '</div>' +
                                '<div class="detail-row">' +
                                    '<span>Progress:</span>' +
                                    '<span>' + job.processedRecords + ' / ' + job.totalRecords + '</span>' +
                                '</div>' +
                                '<div class="progress-bar">' +
                                    '<div class="progress-fill" style="width: ' + progressPercent + '%"></div>' +
                                '</div>' +
                                '<div class="detail-row">' +
                                    '<span>Started:</span>' +
                                    '<span>' + (job.startTime || 'N/A') + '</span>' +
                                '</div>' +
                                '<div class="detail-row">' +
                                    '<span>Last Update:</span>' +
                                    '<span>' + (job.lastUpdate || 'N/A') + '</span>' +
                                '</div>' +
                                (job.currentCommand ? 
                                    '<div class="detail-row">' +
                                        '<span>Current Command:</span>' +
                                        '<span class="command-text">' + job.currentCommand + '</span>' +
                                    '</div>'
                                : '') +
                                (job.error ? 
                                    '<div class="error-message">' +
                                        '<span>Error:</span>' +
                                        '<span>' + job.error + '</span>' +
                                    '</div>'
                                : '') +
                                '<div id="command-details-' + job.jobId + '" class="command-details-section">' +
                                    '<div class="loading">Loading command details...</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>';
                    });
                } else {
                    // Check if we're looking for a specific job
                    const jobIdField = document.getElementById('custpage_job_id');
                    const jobId = jobIdField ? jobIdField.value : null;
                    
                    if (jobId) {
                        html += '<div class="no-jobs">No status found for job: ' + jobId + '<br><br>';
                        html += 'This could mean:<br>';
                        html += '• The MapReduce job has not started yet<br>';
                        html += '• The job completed more than 5 minutes ago<br>';
                        html += '• There was an error starting the job<br><br>';
                        html += 'Check the NetSuite execution log for more details.</div>';
                    } else {
                        html += '<div class="no-jobs">No active MapReduce jobs</div>';
                    }
                }
                
                html += '</div>';
                html += '<div class="last-refresh">Last refreshed: ' + new Date().toLocaleString() + '</div>';
                
                container.innerHTML = html;
                
                // Fetch command details for each job and update progress
                if (statusData.jobs && statusData.jobs.length > 0) {
                    statusData.jobs.forEach(job => {
                        fetchAndDisplayCommandDetails(job.jobId);
                        updateJobProgressWithCommandCount(job.jobId);
                    });
                }
                
                // Add cancel button for single job view if job is cancellable
                const buttonContainer = document.querySelector('.status-header');
                if (buttonContainer && jobId && statusData.jobs && statusData.jobs.length === 1) {
                    const job = statusData.jobs[0];
                    const cancellableStatuses = ['PENDING', 'GETINPUTDATA', 'MAP', 'REDUCE', 'SUMMARIZE'];
                    
                    // Remove any existing cancel button
                    const existingCancelButton = buttonContainer.querySelector('.cancel-button');
                    if (existingCancelButton) {
                        existingCancelButton.remove();
                    }
                    
                    if (cancellableStatuses.includes(job.status)) {
                        const cancelButton = document.createElement('button');
                        cancelButton.textContent = 'Cancel Job';
                        cancelButton.className = 'cancel-button';
                        cancelButton.type = 'button';
                        cancelButton.onclick = function(event) {
                            event.preventDefault();
                            if (confirm('Are you sure you want to cancel this MapReduce job?')) {
                                cancelJob(jobId);
                            }
                            return false;
                        };
                        buttonContainer.appendChild(cancelButton);
                    }
                }
            }
            
            // Set up auto-refresh (always enabled)
            // Use setTimeout to fetch immediately but avoid any timing issues
            setTimeout(function() {
                fetchStatusCore(); // Fetch immediately
                refreshInterval = setInterval(fetchStatusCore, 5000);
            }, 100);
            
            
            // Manual refresh button
            const refreshButton = document.createElement('button');
            refreshButton.textContent = 'Refresh Now';
            refreshButton.className = 'refresh-button';
            refreshButton.type = 'button'; // Prevent form submission
            refreshButton.onclick = function(event) {
                event.preventDefault();
                fetchStatusCore();
                return false;
            };
            
            const buttonContainer = document.querySelector('.status-header');
            if (buttonContainer) {
                buttonContainer.appendChild(refreshButton);
                
                
            }
            
            function fetchAndDisplayCommandDetails(jobId) {
                const restletUrl = '/app/site/hosting/restlet.nl?script=customscript_rl_rest_mr_status&deploy=customdeploy_rl_rest_mr_status1&jobId=' + 
                    encodeURIComponent(jobId) + '&commandHistory=true';
                
                fetch(restletUrl, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                })
                .then(response => response.json())
                .then(data => {
                    const detailsContainer = document.getElementById('command-details-' + jobId);
                    if (!detailsContainer) return;
                    
                    const totalCommands = data.totalCommands || 0;
                    const commandList = data.commandList || [];
                    
                    if (totalCommands > 0) {
                        let detailsHtml = '<h4>Command Execution Progress (' + data.commandHistory.length + '/' + totalCommands + ' completed)</h4>' +
                            '<table class="command-details-table">' +
                            '<thead><tr>' +
                            '<th>#</th>' +
                            '<th>Command</th>' +
                            '<th>Time</th>' +
                            '</tr></thead><tbody>';
                        
                        // Create array for all commands (executed + pending)
                        for (let i = 1; i <= totalCommands; i++) {
                            const executedCmd = data.commandHistory.find(cmd => cmd.commandIndex === i);
                            const plannedCmd = commandList.find(cmd => cmd.index === i);
                            
                            if (executedCmd) {
                                // Command has been executed
                                const statusClass = executedCmd.failed ? 'failed' : 'success';
                                const timeStr = new Date(executedCmd.timestamp).toLocaleTimeString();
                                
                                detailsHtml += '<tr class="' + statusClass + '">' +
                                    '<td>' + i + '</td>' +
                                    '<td>' + executedCmd.currentCommand + 
                                    (executedCmd.failed && executedCmd.result !== 'Failed' ? '<br><small class="error-text">' + executedCmd.result + '</small>' : '') + 
                                    '</td>' +
                                    '<td>' + timeStr + '</td>' +
                                    '</tr>';
                            } else {
                                // Command is pending - show actual command name from stored list
                                const commandName = plannedCmd ? plannedCmd.description : 'Pending...';
                                detailsHtml += '<tr class="pending">' +
                                    '<td>' + i + '</td>' +
                                    '<td>' + commandName + '</td>' +
                                    '<td>-</td>' +
                                    '</tr>';
                            }
                        }
                        
                        detailsHtml += '</tbody></table>';
                        detailsContainer.innerHTML = detailsHtml;
                    } else {
                        detailsContainer.innerHTML = '<div class="no-details">' + (data.message || 'No command details available yet') + '</div>';
                    }
                })
                .catch(error => {
                    const detailsContainer = document.getElementById('command-details-' + jobId);
                    if (detailsContainer) {
                        detailsContainer.innerHTML = '<div class="error">Failed to load command details</div>';
                    }
                });
            }
            
            function updateJobProgressWithCommandCount(jobId) {
                const restletUrl = '/app/site/hosting/restlet.nl?script=customscript_rl_rest_mr_status&deploy=customdeploy_rl_rest_mr_status1&jobId=' + 
                    encodeURIComponent(jobId) + '&commandHistory=true';
                
                fetch(restletUrl, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                })
                .then(response => response.json())
                .then(data => {
                    const totalCommands = data.totalCommands || 0;
                    const completedCommands = data.commandHistory.length || 0;
                    
                    if (totalCommands > 0) {
                        // Find the job card and update progress
                        const jobCards = document.querySelectorAll('.job-card');
                        jobCards.forEach(card => {
                            const jobIdElement = card.querySelector('h3');
                            if (jobIdElement && jobIdElement.textContent === jobId) {
                                // Update progress text
                                const progressRow = card.querySelector('.detail-row span:nth-child(2)');
                                if (progressRow && progressRow.parentElement.querySelector('span:first-child').textContent === 'Progress:') {
                                    progressRow.textContent = completedCommands + ' / ' + totalCommands;
                                }
                                
                                // Update progress bar
                                const progressFill = card.querySelector('.progress-fill');
                                if (progressFill) {
                                    const progressPercent = Math.round((completedCommands / totalCommands) * 100);
                                    progressFill.style.width = progressPercent + '%';
                                }
                            }
                        });
                    }
                })
                .catch(error => {
                    // Silent fail - don't break the main status display
                });
            }
            
            function cancelJob(jobId) {
                const restletUrl = '/app/site/hosting/restlet.nl?script=customscript_rl_rest_mr_status&deploy=customdeploy_rl_rest_mr_status1';
                
                fetch(restletUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        action: 'cancel',
                        jobId: jobId
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert("Job cancellation requested. The job will stop after the current command completes.");
                        fetchStatus(); // Refresh status immediately
                    } else {
                        alert("Failed to cancel job: " + data.message);
                    }
                })
                .catch(error => {
                    console.error('Error canceling job:', error);
                    alert("Error canceling job. Please try again.");
                });
            }
        });
        </script>
    `;
    
    response.writePage(form);
}

function generateStatusHTML(): string {
    return `
        <style>
            .status-container {
                padding: 20px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .status-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .job-card {
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 15px;
                background: #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .job-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                border-bottom: 1px solid #eee;
                padding-bottom: 10px;
            }
            
            .job-header h3 {
                margin: 0;
                color: #333;
                font-size: 16px;
            }
            
            .job-status {
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }
            
            .status-pending { background: #ffc107; color: #fff; }
            .status-getinputdata { background: #17a2b8; color: #fff; }
            .status-map { background: #007bff; color: #fff; }
            .status-reduce { background: #6610f2; color: #fff; }
            .status-summarize { background: #28a745; color: #fff; }
            .status-complete { background: #28a745; color: #fff; }
            .status-failed { background: #dc3545; color: #fff; }
            .status-cancelled { background: #6c757d; color: #fff; }
            
            .job-details {
                font-size: 14px;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
            }
            
            .detail-row span:first-child {
                font-weight: 600;
                color: #666;
            }
            
            .progress-bar {
                height: 20px;
                background: #f0f0f0;
                border-radius: 10px;
                overflow: hidden;
                margin: 10px 0;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #45a049);
                transition: width 0.3s ease;
            }
            
            .command-text {
                font-family: monospace;
                font-size: 12px;
                color: #0066cc;
                word-break: break-all;
            }
            
            .error-message {
                margin-top: 10px;
                padding: 10px;
                background: #fee;
                border-left: 3px solid #dc3545;
                color: #721c24;
                font-size: 12px;
            }
            
            .no-jobs {
                text-align: center;
                padding: 40px;
                color: #999;
                font-size: 16px;
            }
            
            .last-refresh {
                text-align: right;
                color: #999;
                font-size: 12px;
                margin-top: 10px;
            }
            
            .refresh-button {
                padding: 8px 16px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-left: 10px;
            }
            
            .refresh-button:hover {
                background: #0056b3;
            }
            
            .cancel-button {
                padding: 8px 16px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-left: 10px;
            }
            
            .cancel-button:hover {
                background: #c82333;
            }
            
            .command-details-section {
                margin-top: 15px;
                padding: 10px;
                border-top: 1px solid #eee;
                background: #f8f9fa;
            }
            
            .command-details-section h4 {
                margin: 0 0 10px 0;
                color: #495057;
                font-size: 14px;
            }
            
            .loading, .no-details, .error {
                padding: 10px;
                text-align: center;
                font-style: italic;
                color: #6c757d;
            }
            
            .error {
                color: #dc3545;
            }
            
            .command-details-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            
            .command-details-table th,
            .command-details-table td {
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }
            
            .command-details-table th {
                background: #f8f9fa;
                font-weight: bold;
            }
            
            .command-details-table tr.success {
                background-color: #d4edda;
                border-left: 4px solid #28a745;
            }
            
            .command-details-table tr.failed {
                background-color: #f8d7da;
                border-left: 4px solid #dc3545;
            }
            
            .command-details-table tr.pending {
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                color: #856404;
            }
            
            .error-text {
                color: #dc3545;
                font-style: italic;
                display: block;
                margin-top: 4px;
            }
        </style>
        
        <div class="status-container">
            <div class="status-header">
                <h2>Active MapReduce Jobs</h2>
            </div>
            <div id="mapreduce_status_container">
                <div class="no-jobs">Loading status...</div>
            </div>
        </div>
    `;
}