# gemini-model-checker.py
import os
from dotenv import load_dotenv
from google import genai

def list_gemini_models():
    """Fetches and cleanly displays all available models using the Google GenAI SDK."""
    
    # 1. Securely load the GEMINI_API_KEY from your .env file
    load_dotenv()

    try:
        # 2. Initialize the unified client
        client = genai.Client()
        print("✅ Successfully authenticated with Google GenAI.\n")
    except Exception as e:
        print(f"❌ Failed to initialize client. Ensure your .env file is set up.\nError: {e}")
        return

    print("Fetching available models...\n")
    
    # 3. Set up a readable table header for a good developer experience
    print(f"{'Model ID':<40} | {'Display Name':<30}")
    print("-" * 75)

    try:
        # 4. Iterate through the paginated list of available models
        for model in client.models.list():
            # Safely extract the attributes
            model_id = getattr(model, 'name', 'Unknown')
            display_name = getattr(model, 'display_name', '')
            
            print(f"{model_id:<40} | {display_name:<30}")
            
    except Exception as e:
        print(f"❌ Error fetching models: {e}")

if __name__ == "__main__":
    list_gemini_models()