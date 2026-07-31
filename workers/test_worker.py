import modal
# Import the function and app from your main worker file
from maha_workers import run_tensor_opt, app

@app.local_entrypoint()
def test_main():
    test_payload = {
        "jobId": "test_job_123",
        "inputHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "callbackUrl": "https://httpbin.org/post", # A public URL that simply echoes requests
        "problem": {"size": 4}
    }
    
    print("🚀 Spawning local test job on Modal GPU...")
    # .remote() runs it synchronously so we can see the logs in real time
    run_tensor_opt.remote(test_payload)
    print("✅ Local test execution completed successfully!")