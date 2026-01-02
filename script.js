document.addEventListener('DOMContentLoaded', () => {
    
    // ==============================================
    // MOBILE MENU (EXISTING)
    // ==============================================
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.textContent = nav.classList.contains('active') ? '✕' : '☰';
        });
        
        // Close menu when clicking links
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                menuToggle.textContent = '☰';
            });
        });
    }

    // ==============================================
    // BACKEND INTEGRATION VARIABLES & DOM ELEMENTS
    // ==============================================
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    const POLL_INTERVAL = 2000;
    const MAX_POLLS = 60;
    let currentUploadedUrl = null;

    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const previewImage = document.getElementById('preview-image');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resultPlaceholder = document.getElementById('result-placeholder');
    const resultImage = document.getElementById('result-image');
    const loadingState = document.getElementById('loading-state');
    const downloadBtn = document.getElementById('download-btn');

    // ==============================================
    // HELPER FUNCTIONS
    // ==============================================

    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // UI Helpers
    function showLoading() {
        if (loadingState) loadingState.classList.remove('hidden');
        if (loadingState) loadingState.style.display = 'flex'; // Ensure flex layout
    }

    function hideLoading() {
        if (loadingState) loadingState.classList.add('hidden');
        if (loadingState) loadingState.style.display = 'none';
    }

    function updateStatus(text) {
        // Try to find a status text element, or update button text
        const statusText = document.getElementById('status-text') || document.querySelector('.status-text');
        if (statusText) statusText.textContent = text;
        
        if (generateBtn) {
            if (text.includes('PROCESSING') || text.includes('UPLOADING') || text.includes('SUBMITTING') || text.includes('QUEUED')) {
                generateBtn.disabled = true;
                generateBtn.textContent = text;
            } else if (text === 'READY') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Vector Art';
            } else if (text === 'COMPLETE') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Again';
            }
        }
    }

    function showPreview(url) {
        if (previewImage) {
            previewImage.src = url;
            previewImage.classList.remove('hidden');
        }
        if (uploadZone) {
            const placeholder = uploadZone.querySelector('.upload-placeholder');
            if (placeholder) placeholder.classList.add('hidden');
        }
    }

    function showError(msg) {
        alert('Error: ' + msg);
        console.error(msg);
    }

    // API: Upload File
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        const fileName = uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL
        const signedUrlResponse = await fetch(
            'https://api.chromastudio.ai/get-emd-upload-url?fileName=' + encodeURIComponent(fileName),
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        
        // Step 2: PUT file
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Step 3: Return download URL
        return 'https://contents.maxstudio.ai/' + fileName;
    }

    // API: Submit Job
    async function submitImageGenJob(imageUrl) {
        // Config for photoToVectorArt
        const body = {
            model: 'image-effects',
            toolType: 'image-effects',
            effectId: 'photoToVectorArt',
            imageUrl: imageUrl,
            userId: USER_ID,
            removeWatermark: true,
            isPrivate: true
        };

        const response = await fetch('https://api.chromastudio.ai/image-gen', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        return await response.json();
    }

    // API: Poll Status
    async function pollJobStatus(jobId) {
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `https://api.chromastudio.ai/image-gen/${USER_ID}/${jobId}/status`,
                { method: 'GET' }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status: ' + response.statusText);
            }
            
            const data = await response.json();
            console.log('Poll', polls + 1, '- Status:', data.status);
            
            if (data.status === 'completed') {
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            updateStatus('PROCESSING... (' + (polls + 1) + ')');
            
            // Wait 2 seconds
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out');
    }

    // Logic: Handle File Selection
    async function handleFileSelect(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        try {
            showLoading();
            updateStatus('UPLOADING...');
            
            // Hide result area if visible
            if (resultImage) resultImage.classList.add('hidden');
            if (resultPlaceholder) resultPlaceholder.classList.remove('hidden');
            if (downloadBtn) downloadBtn.disabled = true;

            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            showPreview(uploadedUrl);
            updateStatus('READY');
            hideLoading();
            
            if (generateBtn) generateBtn.disabled = false;
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // Logic: Handle Generation
    async function handleGenerate() {
        if (!currentUploadedUrl) return;
        
        try {
            showLoading();
            updateStatus('SUBMITTING JOB...');
            if (generateBtn) generateBtn.disabled = true;
            
            const jobData = await submitImageGenJob(currentUploadedUrl);
            
            updateStatus('JOB QUEUED...');
            
            const result = await pollJobStatus(jobData.jobId);
            
            // Extract result URL
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.mediaUrl || resultItem?.image || resultItem?.video;
            
            if (!resultUrl) throw new Error('No result URL found');
            
            // Display Result
            if (resultImage) {
                // Add timestamp to bypass cache if needed, usually not for new generations
                resultImage.src = resultUrl;
                resultImage.classList.remove('hidden');
                // Remove CSS filters used in demo
                resultImage.style.filter = 'none';
            }
            
            if (resultPlaceholder) resultPlaceholder.classList.add('hidden');
            
            // Setup Download
            if (downloadBtn) {
                downloadBtn.dataset.url = resultUrl;
                downloadBtn.disabled = false;
            }
            
            updateStatus('COMPLETE');
            hideLoading();
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
            if (generateBtn) generateBtn.disabled = false;
        }
    }

    // ==============================================
    // EVENT WIRING
    // ==============================================

    // File Input
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFileSelect(e.target.files[0]);
        });
    }

    // Upload Zone
    if (uploadZone) {
        uploadZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
        
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--primary)';
            uploadZone.style.background = 'rgba(79, 70, 229, 0.1)';
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = '';
            uploadZone.style.background = '';
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '';
            uploadZone.style.background = '';
            if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
        });
    }

    // Generate Button
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentUploadedUrl = null;
            if (fileInput) fileInput.value = '';
            
            if (previewImage) {
                previewImage.src = '';
                previewImage.classList.add('hidden');
            }
            
            if (uploadZone) {
                const placeholder = uploadZone.querySelector('.upload-placeholder');
                if (placeholder) placeholder.classList.remove('hidden');
            }
            
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Generate Vector Art';
            }
            
            if (resultImage) {
                resultImage.src = '';
                resultImage.classList.add('hidden');
            }
            
            if (resultPlaceholder) resultPlaceholder.classList.remove('hidden');
            if (downloadBtn) downloadBtn.disabled = true;
            
            // Clear Status
            const statusText = document.getElementById('status-text');
            if (statusText) statusText.textContent = '';
        });
    }

    // Download Button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const url = downloadBtn.dataset.url || (resultImage ? resultImage.src : null);
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.disabled = true;

            function downloadBlob(blob, filename) {
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }

            try {
                // Strategy 1: Proxy
                const proxyUrl = 'https://api.chromastudio.ai/download-proxy?url=' + encodeURIComponent(url);
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Proxy failed');
                const blob = await response.blob();
                downloadBlob(blob, 'vector_art_' + generateNanoId(8) + '.png');
            } catch (err) {
                console.warn('Proxy download failed, trying direct:', err);
                // Strategy 2: Direct
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Direct fetch failed');
                    const blob = await response.blob();
                    downloadBlob(blob, 'vector_art_' + generateNanoId(8) + '.png');
                } catch (finalErr) {
                    alert('Download failed. Please right-click the image and "Save Image As".');
                }
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        });
    }

    // ==============================================
    // FAQ ACCORDION (EXISTING)
    // ==============================================
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                faqItems.forEach(otherItem => otherItem.classList.remove('active'));
                if (!isActive) item.classList.add('active');
            });
        }
    });

    // ==============================================
    // MODALS (EXISTING)
    // ==============================================
    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }
    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
    document.querySelectorAll('[data-modal-target]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-modal-target');
            openModal(targetId);
        });
    });
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-modal-close');
            closeModal(targetId);
        });
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // ==============================================
    // SCROLL ANIMATIONS (EXISTING)
    // ==============================================
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'none';
                entry.target.offsetHeight; 
                
                if (entry.target.classList.contains('fade-in-up')) {
                    entry.target.style.animation = 'fadeInUp 0.8s ease forwards';
                } else if (entry.target.classList.contains('fade-in-left')) {
                    entry.target.style.animation = 'fadeInLeft 0.8s ease forwards';
                } else if (entry.target.classList.contains('fade-in-right')) {
                    entry.target.style.animation = 'fadeInRight 0.8s ease forwards';
                }
                
                if (entry.target.classList.contains('stagger-children')) {
                    const children = entry.target.children;
                    for(let i=0; i<children.length; i++) {
                        children[i].style.animation = `fadeInUp 0.6s ease forwards ${i * 0.1}s`;
                    }
                }
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .stagger-children').forEach(el => {
        observer.observe(el);
    });
});