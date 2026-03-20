const logger = require('../../utils/logger');

class ARVerificationService {
  constructor() {
    this.siteMarkers = new Map(); // siteId -> marker data
  }

  async registerSite(siteId, markerImages, location) {
    try {
      if (!siteId || !markerImages || !Array.isArray(markerImages) || markerImages.length === 0) {
        throw new Error('siteId and at least one marker image are required');
      }

      // Extract features from marker images for AR recognition
      const markers = [];

      for (const image of markerImages) {
        const features = await this.extractFeatures(image);
        markers.push({
          image,
          features,
          location
        });
      }

      this.siteMarkers.set(siteId, markers);

      return {
        siteId,
        markersRegistered: markers.length
      };
    } catch (error) {
      logger.error('Error in registerSite:', error);
      throw error;
    }
  }

  async extractFeatures(imageBuffer) {
    try {
      // Use computer vision to extract distinctive features
      // This would use ORB, SIFT, or similar algorithms

      return {
        keypoints: [], // Detected keypoints
        descriptors: [] // Feature descriptors
      };
    } catch (error) {
      logger.error('Error in extractFeatures:', error);
      throw error;
    }
  }

  async verifyLocation(userId, imageBuffer, gpsLocation) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      // First verify GPS is roughly correct
      if (!this.verifyGPS(gpsLocation)) {
        return {
          verified: false,
          reason: 'GPS location out of range'
        };
      }

      // Then verify AR markers
      const siteMatch = await this.findMatchingSite(imageBuffer);

      if (!siteMatch) {
        return {
          verified: false,
          reason: 'No matching AR markers found'
        };
      }

      // Check if user is assigned to this site
      const isAssigned = await this.checkUserAssignment(userId, siteMatch.siteId);

      if (!isAssigned) {
        return {
          verified: false,
          reason: 'User not assigned to this site',
          siteMatched: siteMatch.siteId
        };
      }

      // All checks passed
      return {
        verified: true,
        siteId: siteMatch.siteId,
        confidence: siteMatch.confidence,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error in verifyLocation:', error);
      throw error;
    }
  }

  verifyGPS(gpsLocation) {
    // Check if GPS coordinates are within allowed range
    if (!gpsLocation || !gpsLocation.lat || !gpsLocation.lng) {
      return false;
    }

    // If no sites registered, return false by default (deny by default)
    if (this.siteMarkers.size === 0) {
      return false;
    }

    // Check against registered site locations
    for (const [siteId, markers] of this.siteMarkers.entries()) {
      for (const marker of markers) {
        if (!marker.location) continue;

        const distance = this.calculateDistance(
          gpsLocation.lat, gpsLocation.lng,
          marker.location.lat, marker.location.lng
        );

        // Within 500 meters
        if (distance < 500) return true;
      }
    }

    return false;
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    // Haversine formula for distance between two GPS points
    const R = 6371e3; // Earth's radius in meters
    const toRad = (deg) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  async findMatchingSite(imageBuffer) {
    try {
      if (!imageBuffer) {
        return null;
      }

      // Extract features from current image
      const currentFeatures = await this.extractFeatures(imageBuffer);

      let bestMatch = null;
      let bestScore = 0;

      // Compare against all registered sites
      for (const [siteId, markers] of this.siteMarkers.entries()) {
        for (const marker of markers) {
          const matchScore = this.compareFeatures(currentFeatures, marker.features);

          if (matchScore > bestScore && matchScore > 0.7) { // Threshold
            bestScore = matchScore;
            bestMatch = {
              siteId,
              confidence: matchScore
            };
          }
        }
      }

      return bestMatch;
    } catch (error) {
      logger.error('Error in findMatchingSite:', error);
      return null;
    }
  }

  compareFeatures(features1, features2) {
    // Compare feature descriptors
    // Return similarity score between 0 and 1
    if (!features1 || !features2) return 0;
    if (!features1.keypoints.length || !features2.keypoints.length) {
      return 0;
    }
    return 0.85; // Placeholder
  }

  async checkUserAssignment(userId, siteId) {
    try {
      // Check if user is assigned to this site for today
      return true; // Placeholder
    } catch (error) {
      logger.error('Error in checkUserAssignment:', error);
      return false;
    }
  }

  /**
   * Remove a registered site and its markers to free memory.
   */
  removeSite(siteId) {
    if (!siteId) {
      throw new Error('siteId is required');
    }

    const existed = this.siteMarkers.delete(siteId);
    return { siteId, removed: existed };
  }

  /**
   * Remove all registered sites.
   */
  clearAllSites() {
    const count = this.siteMarkers.size;
    this.siteMarkers.clear();
    return { removedCount: count };
  }
}

module.exports = new ARVerificationService();
