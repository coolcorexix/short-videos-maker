/**
 * Utility class for time-related operations
 */
class TimeUtils {
  /**
   * Convert seconds to HH:MM:SS format
   * @param seconds Number of seconds
   * @returns Formatted time string
   */
  static secondsToTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Convert HH:MM:SS format to seconds
   * @param timestamp Time in HH:MM:SS format
   * @returns Number of seconds
   */
  static timestampToSeconds(timestamp: string): number {
    const parts = timestamp.split(':').map(Number);
    
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1];
    } else {
      // Invalid format
      return 0;
    }
  }
  
  /**
   * Format duration in seconds to a human-readable string
   * @param seconds Duration in seconds
   * @returns Formatted duration string
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
  
  /**
   * Add two timestamps
   * @param timestamp1 First timestamp in HH:MM:SS format
   * @param timestamp2 Second timestamp in HH:MM:SS format
   * @returns Sum of timestamps in HH:MM:SS format
   */
  static addTimestamps(timestamp1: string, timestamp2: string): string {
    const seconds1 = this.timestampToSeconds(timestamp1);
    const seconds2 = this.timestampToSeconds(timestamp2);
    
    return this.secondsToTimestamp(seconds1 + seconds2);
  }
  
  /**
   * Subtract two timestamps
   * @param timestamp1 First timestamp in HH:MM:SS format
   * @param timestamp2 Second timestamp in HH:MM:SS format
   * @returns Difference of timestamps in HH:MM:SS format
   */
  static subtractTimestamps(timestamp1: string, timestamp2: string): string {
    const seconds1 = this.timestampToSeconds(timestamp1);
    const seconds2 = this.timestampToSeconds(timestamp2);
    
    return this.secondsToTimestamp(Math.max(0, seconds1 - seconds2));
  }
}

export default TimeUtils; 