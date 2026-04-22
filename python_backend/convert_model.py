"""
Convert TFLite model to ONNX format for Render compatibility.
Run this script locally to convert the model.
"""

import tensorflow as tf

# Load TFLite model
interpreter = tf.lite.Interpreter(model_path="models/deepfake_model.tflite")
interpreter.allocate_tensors()

# Get input/output details
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

print("Input details:", input_details)
print("Output details:", output_details)

# Note: TFLite to ONNX conversion requires additional tools
# For now, this script shows the model structure
# Use tf2onnx for actual conversion:
# pip install tf2onnx
# python -m tf2onnx.convert --saved-model models/deepfake_model.tflite --output models/deepfake_model.onnx

print("\nTo convert to ONNX, run:")
print("pip install tf2onnx")
print("python -m tf2onnx.convert --saved-model models/deepfake_model.tflite --output models/deepfake_model.onnx")
