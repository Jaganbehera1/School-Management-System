// useLocation.ts
import { useState, useCallback } from 'react';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface LocationError {
  code: number;
  message: string;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = useCallback((): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = {
          code: 0,
          message: 'Geolocation is not supported by this browser',
        };
        setError(error);
        reject(error);
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          setLocation(locationData);
          setLoading(false);
          resolve(locationData);
        },
        (error) => {
          const locationError = {
            code: error.code,
            message: getErrorMessage(error.code),
          };
          setError(locationError);
          setLoading(false);
          reject(locationError);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increased timeout to 15 seconds
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }, []);

  const getAddressFromCoordinates = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      // Using a simple reverse geocoding approach
      // In production, you might want to use a proper geocoding service
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error('Error getting address:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }, []);

  return {
    location,
    error,
    loading,
    getCurrentLocation,
    getAddressFromCoordinates,
  };
}

// Helper function to get user-friendly error messages
function getErrorMessage(errorCode: number): string {
  switch (errorCode) {
    case 1:
      return 'Location permission denied. Please enable location services in your browser settings.';
    case 2:
      return 'Location unavailable. Please check your network connection and try again.';
    case 3:
      return 'Location request timed out. Please try again.';
    default:
      return 'An unknown error occurred while getting your location.';
  }
}