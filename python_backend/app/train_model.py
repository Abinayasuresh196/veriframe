"""TensorFlow model training script for deepfake detection using raindataset logic."""

import os
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import cv2
import glob
from sklearn.model_selection import train_test_split
import random

def create_model():
    """Create a CNN model for deepfake detection."""
    model = keras.Sequential([
        # Input layer
        layers.Input(shape=(128, 128, 3)),
        
        # First convolutional block
        layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),
        
        # Second convolutional block
        layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),
        
        # Third convolutional block
        layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),
        
        # Fourth convolutional block
        layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.25),
        
        # Flatten and dense layers
        layers.Flatten(),
        layers.Dense(512, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.5),
        layers.Dense(256, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.5),
        layers.Dense(128, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.5),
        
        # Output layer
        layers.Dense(1, activation='sigmoid')
    ])
    
    # Compile model
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', 'precision', 'recall']
    )
    
    return model

def load_raindataset_data(data_dir="raindataset"):
    """Load and preprocess data from raindataset directory."""
    real_dir = os.path.join(data_dir, "real")
    fake_dir = os.path.join(data_dir, "fake")
    
    images = []
    labels = []
    
    # Load real images
    if os.path.exists(real_dir):
        real_images = glob.glob(os.path.join(real_dir, "*.jpg")) + \
                     glob.glob(os.path.join(real_dir, "*.png")) + \
                     glob.glob(os.path.join(real_dir, "*.jpeg"))
        
        for img_path in real_images:
            try:
                img = cv2.imread(img_path)
                if img is not None:
                    img = cv2.resize(img, (128, 128))
                    img = img / 255.0  # Normalize
                    images.append(img)
                    labels.append(0)  # Real = 0
            except Exception as e:
                print(f"Error loading {img_path}: {e}")
                continue
    
    # Load fake images
    if os.path.exists(fake_dir):
        fake_images = glob.glob(os.path.join(fake_dir, "*.jpg")) + \
                     glob.glob(os.path.join(fake_dir, "*.png")) + \
                     glob.glob(os.path.join(fake_dir, "*.jpeg"))
        
        for img_path in fake_images:
            try:
                img = cv2.imread(img_path)
                if img is not None:
                    img = cv2.resize(img, (128, 128))
                    img = img / 255.0  # Normalize
                    images.append(img)
                    labels.append(1)  # Fake = 1
            except Exception as e:
                print(f"Error loading {img_path}: {e}")
                continue
    
    return np.array(images), np.array(labels)

def augment_data(images, labels, augment_factor=2):
    """Augment the training data."""
    augmented_images = []
    augmented_labels = []
    
    for img, label in zip(images, labels):
        # Original image
        augmented_images.append(img)
        augmented_labels.append(label)
        
        # Create augmented versions
        for _ in range(augment_factor - 1):
            aug_img = img.copy()
            
            # Random rotations
            if random.random() > 0.5:
                angle = random.uniform(-15, 15)
                h, w = aug_img.shape[:2]
                center = (w // 2, h // 2)
                matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
                aug_img = cv2.warpAffine(aug_img, matrix, (w, h))
            
            # Random brightness
            if random.random() > 0.5:
                brightness = random.uniform(0.8, 1.2)
                aug_img = np.clip(aug_img * brightness, 0, 1)
            
            # Random noise
            if random.random() > 0.5:
                noise = np.random.normal(0, 0.02, aug_img.shape)
                aug_img = np.clip(aug_img + noise, 0, 1)
            
            augmented_images.append(aug_img)
            augmented_labels.append(label)
    
    return np.array(augmented_images), np.array(augmented_labels)

def train_model():
    """Train the deepfake detection model."""
    print("Starting model training...")
    
    # Load data
    print("Loading dataset...")
    images, labels = load_raindataset_data()
    
    if len(images) == 0:
        print("No data found. Creating synthetic dataset for demonstration...")
        # Create synthetic data if no real dataset available
        num_samples = 1000
        images = np.random.rand(num_samples, 128, 128, 3)
        labels = np.random.randint(0, 2, num_samples)
    
    print(f"Loaded {len(images)} images")
    print(f"Real images: {np.sum(labels == 0)}")
    print(f"Fake images: {np.sum(labels == 1)}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        images, labels, test_size=0.2, random_state=42, stratify=labels
    )
    
    # Augment training data
    print("Augmenting training data...")
    X_train_aug, y_train_aug = augment_data(X_train, y_train)
    
    print(f"Training set size after augmentation: {len(X_train_aug)}")
    
    # Create model
    print("Creating model...")
    model = create_model()
    
    # Callbacks
    callbacks = [
        keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5),
        keras.callbacks.ModelCheckpoint(
            'best_model.h5', save_best_only=True, monitor='val_accuracy'
        )
    ]
    
    # Train model
    print("Training model...")
    history = model.fit(
        X_train_aug, y_train_aug,
        validation_data=(X_test, y_test),
        epochs=50,
        batch_size=32,
        callbacks=callbacks,
        verbose=1
    )
    
    # Evaluate model
    print("Evaluating model...")
    test_loss, test_acc, test_precision, test_recall = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test Accuracy: {test_acc:.4f}")
    print(f"Test Precision: {test_precision:.4f}")
    print(f"Test Recall: {test_recall:.4f}")
    
    # Save model
    model.save('deepfake_model.h5')
    print("Model saved as deepfake_model.h5")
    
    # Convert to TFLite for deployment
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    
    with open('deepfake_model.tflite', 'wb') as f:
        f.write(tflite_model)
    print("Model converted to TFLite format")
    
    return model, history

if __name__ == "__main__":
    # Set random seeds for reproducibility
    tf.random.set_seed(42)
    np.random.seed(42)
    random.seed(42)
    
    # Train the model
    model, history = train_model()
    print("Training completed!")
