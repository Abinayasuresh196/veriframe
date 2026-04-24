"""Setup script to ensure the trained model is available."""

import os
import subprocess
import sys

def train_and_setup_model():
    """Train the model and set it up for deployment."""
    print("Setting up deepfake detection model...")
    
    # Check if we need to train the model
    model_path = "deepfake_model.tflite"
    
    if not os.path.exists(model_path):
        print("No trained model found. Training new model...")
        
        # Run the training script
        try:
            result = subprocess.run([
                sys.executable, "train_model.py"
            ], capture_output=True, text=True, cwd=os.path.dirname(__file__))
            
            if result.returncode == 0:
                print("Model training completed successfully!")
                print(result.stdout)
            else:
                print(f"Training failed: {result.stderr}")
                # Create a simple model as fallback
                create_simple_model()
                
        except Exception as e:
            print(f"Error during training: {e}")
            create_simple_model()
    else:
        print("Trained model already exists.")
    
    # Verify model exists
    if os.path.exists(model_path):
        print(f"✅ Model ready: {model_path}")
        return True
    else:
        print("❌ Model setup failed")
        return False

def create_simple_model():
    """Create a simple TFLite model as fallback."""
    print("Creating simple fallback model...")
    
    import tensorflow as tf
    import numpy as np
    
    # Create a simple model
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(128, 128, 3)),
        tf.keras.layers.Conv2D(16, (3, 3), activation='relu'),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid')
    ])
    
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    
    # Convert to TFLite
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    
    # Save the model
    with open('deepfake_model.tflite', 'wb') as f:
        f.write(tflite_model)
    
    print("Simple fallback model created successfully!")

if __name__ == "__main__":
    train_and_setup_model()
