const tf = require('@tensorflow/tfjs-node');
const cocoSsd = require('@tensorflow-models/coco-ssd');

class ObjectDetectionService {
  constructor() {
    this.model = null;
    this.safetyClasses = [
      'helmet', 'vest', 'goggles', 'gloves',
      'hard hat', 'safety vest', 'safety glasses'
    ];
  }

  async loadModel() {
    // Load pre-trained model (you'd fine-tune on PPE dataset)
    this.model = await cocoSsd.load();
    console.log('Object detection model loaded');
  }

  async detectPPE(imageBuffer) {
    if (!this.model) await this.loadModel();

    const image = await this.bufferToTensor(imageBuffer);
    const predictions = await this.model.detect(image);

    const ppeDetected = {
      helmet: false,
      vest: false,
      goggles: false,
      gloves: false,
      allRequired: false,
      missing: []
    };

    // Map detections to PPE categories
    predictions.forEach(pred => {
      const className = pred.class.toLowerCase();

      if (className.includes('helmet') || className.includes('hard hat')) {
        ppeDetected.helmet = true;
      }
      if (className.includes('vest')) {
        ppeDetected.vest = true;
      }
      if (className.includes('glass') || className.includes('goggle')) {
        ppeDetected.goggles = true;
      }
      if (className.includes('glove')) {
        ppeDetected.gloves = true;
      }
    });

    // Determine missing PPE
    const required = ['helmet', 'vest', 'goggles', 'gloves'];
    ppeDetected.missing = required.filter(item => !ppeDetected[item]);
    ppeDetected.allRequired = ppeDetected.missing.length === 0;

    return {
      detections: predictions,
      ppe: ppeDetected,
      timestamp: new Date()
    };
  }

  async detectTools(imageBuffer) {
    // Detect if employee is carrying required tools/equipment
    if (!this.model) await this.loadModel();

    const image = await this.bufferToTensor(imageBuffer);
    const predictions = await this.model.detect(image);

    // Filter for tools (laptop, toolbox, etc.)
    const tools = predictions.filter(p =>
      ['laptop', 'cell phone', 'book', 'backpack'].includes(p.class)
    );

    return tools.map(t => ({
      name: t.class,
      confidence: t.score,
      boundingBox: t.bbox
    }));
  }

  async bufferToTensor(buffer) {
    // Convert buffer to tensor for model input
    return tf.node.decodeImage(buffer);
  }
}

module.exports = new ObjectDetectionService();
