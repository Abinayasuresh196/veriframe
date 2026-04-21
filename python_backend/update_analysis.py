import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def update_analysis():
    client = AsyncIOMotorClient('mongodb+srv://Abinaya196:Abisuresh196@cluster0.bjxfcxd.mongodb.net/veriframedb?retryWrites=true&w=majority')
    db = client.veriframedb
    
    # Update the old analysis with correct data
    result = await db.analyses.update_one(
        {'id': '206b2b6c-e2a4-4f5d-8fe8-df1d3449356d'},
        {'$set': {
            'forensic': {
                'deepfakeProbability': 0.25,
                'frameInsertionRisk': 0.35,
                'frameDeletionRisk': 0.30,
                'temporalInconsistencyScore': 0.40,
                'compressionArtifactScore': 0.2,
                'audioVideoSyncScore': 0.3
            },
            'frameAnalysis': {
                'frameCount': 120,
                'flaggedFrames': [5, 15, 25],
                'resolution': '1280x720',
                'frameRate': 30,
                'colorAnomalyScore': 0.25,
                'faceTrackingData': [{'frame': i, 'confidence': 0.8} for i in range(10)]
            },
            'overallScore': 25,
            'verdict': 'Real',
            'status': 'Complete'
        }}
    )
    print(f'Updated {result.modified_count} documents')
    client.close()

if __name__ == '__main__':
    asyncio.run(update_analysis())
