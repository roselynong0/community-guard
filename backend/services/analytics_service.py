"""
Analytics Service
Provides data analysis, trend detection, and visualizations using scikit-learn and pandas
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from collections import Counter, defaultdict
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from io import BytesIO
import base64

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for data analysis and insights"""
    
    def __init__(self):
        """Initialize analytics service"""
        logger.info("✓ Analytics Service initialized")
    
    def prepare_dataframe(self, reports: List[Dict]) -> Optional[pd.DataFrame]:
        """
        Convert reports list to pandas DataFrame
        
        Args:
            reports: List of incident report dicts
        
        Returns:
            DataFrame or None if error
        """
        try:
            if not reports:
                logger.warning("No reports to process")
                return None
            
            df = pd.DataFrame(reports)
            
            # Convert timestamp to datetime if present
            if "timestamp" in df.columns:
                df["timestamp"] = pd.to_datetime(df["timestamp"])
            
            return df
            
        except Exception as e:
            logger.error(f"Error preparing DataFrame: {e}")
            return None
    
    def get_category_distribution(self, reports: List[Dict]) -> Dict[str, int]:
        """
        Get distribution of incident categories
        
        Args:
            reports: List of reports
        
        Returns:
            Dict with category counts
        """
        try:
            categories = [r.get("category", "Other") for r in reports]
            return dict(Counter(categories))
        except Exception as e:
            logger.error(f"Error calculating category distribution: {e}")
            return {}
    
    def get_temporal_trends(self, reports: List[Dict], period: str = "day") -> Dict[str, int]:
        """
        Get incident trends over time
        
        Args:
            reports: List of reports
            period: 'day', 'week', or 'month'
        
        Returns:
            Dict with time bins and counts
        """
        try:
            df = self.prepare_dataframe(reports)
            if df is None or "timestamp" not in df.columns:
                return {}
            
            # Group by time period
            if period == "hour":
                grouped = df.groupby(df["timestamp"].dt.floor("H")).size()
            elif period == "day":
                grouped = df.groupby(df["timestamp"].dt.floor("D")).size()
            elif period == "week":
                grouped = df.groupby(df["timestamp"].dt.floor("W")).size()
            elif period == "month":
                grouped = df.groupby(df["timestamp"].dt.floor("M")).size()
            else:
                return {}
            
            return grouped.to_dict()
            
        except Exception as e:
            logger.error(f"Error calculating temporal trends: {e}")
            return {}
    
    def get_hotspots(self, reports: List[Dict], top_n: int = 5) -> List[Dict[str, Any]]:
        """
        Identify top incident locations (hotspots)
        
        Args:
            reports: List of reports with location info
            top_n: Number of top locations to return
        
        Returns:
            List of dicts with location and count
        """
        try:
            locations = {}
            for report in reports:
                loc = report.get("location", "Unknown")
                locations[loc] = locations.get(loc, 0) + 1
            
            # Sort by frequency
            sorted_locs = sorted(locations.items(), key=lambda x: x[1], reverse=True)
            
            return [
                {"location": loc, "count": count}
                for loc, count in sorted_locs[:top_n]
            ]
            
        except Exception as e:
            logger.error(f"Error identifying hotspots: {e}")
            return []
    
    def detect_anomalies(self, reports: List[Dict]) -> List[Dict[str, Any]]:
        """
        Detect anomalous incidents using clustering
        
        Args:
            reports: List of reports
        
        Returns:
            List of anomalous incidents
        """
        try:
            df = self.prepare_dataframe(reports)
            if df is None or len(df) < 3:
                return []
            
            # Extract numerical features
            features = []
            for _, report in df.iterrows():
                # Create feature vector: [hour, day_of_week, report_length, priority]
                ts = report.get("timestamp", datetime.now())
                if isinstance(ts, str):
                    ts = pd.to_datetime(ts)
                
                hour = ts.hour if hasattr(ts, "hour") else 0
                dow = ts.weekday() if hasattr(ts, "weekday") else 0
                desc_len = len(str(report.get("description", "")))
                priority = {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(
                    str(report.get("priority", "low")).lower(), 2
                )
                
                features.append([hour, dow, min(desc_len / 100, 10), priority])
            
            if len(features) < 3:
                return []
            
            X = np.array(features)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # K-means clustering for anomaly detection
            try:
                n_clusters = max(2, int(len(reports) / 10))
                kmeans = KMeans(n_clusters=min(n_clusters, len(reports) - 1), random_state=42)
                clusters = kmeans.fit_predict(X_scaled)
                
                # Find smallest clusters (anomalies)
                cluster_counts = Counter(clusters)
                small_clusters = [c for c, count in cluster_counts.items() if count <= 2]
                
                anomalies = []
                for idx, cluster in enumerate(clusters):
                    if cluster in small_clusters:
                        anomalies.append({
                            "index": idx,
                            "report": reports[idx],
                            "anomaly_score": float(np.linalg.norm(X_scaled[idx] - kmeans.cluster_centers_[cluster]))
                        })
                
                return sorted(anomalies, key=lambda x: x["anomaly_score"], reverse=True)[:5]
                
            except Exception as e:
                logger.warning(f"KMeans clustering failed: {e}")
                return []
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            return []
    
    def get_priority_breakdown(self, reports: List[Dict]) -> Dict[str, int]:
        """Get breakdown of reports by priority"""
        try:
            priorities = [r.get("priority", "medium") for r in reports]
            return dict(Counter(priorities))
        except Exception as e:
            logger.error(f"Error calculating priority breakdown: {e}")
            return {}
    
    def get_response_stats(self, reports: List[Dict]) -> Dict[str, Any]:
        """
        Calculate response time statistics
        
        Args:
            reports: List of reports with response data
        
        Returns:
            Stats dict with mean, median, std, min, max response times
        """
        try:
            response_times = []
            for report in reports:
                if "response_time" in report and report["response_time"]:
                    try:
                        response_times.append(float(report["response_time"]))
                    except (ValueError, TypeError):
                        pass
            
            if not response_times:
                return {"error": "No response time data available"}
            
            response_times = np.array(response_times)
            
            return {
                "mean": float(np.mean(response_times)),
                "median": float(np.median(response_times)),
                "std": float(np.std(response_times)),
                "min": float(np.min(response_times)),
                "max": float(np.max(response_times)),
                "total_reports": len(reports)
            }
            
        except Exception as e:
            logger.error(f"Error calculating response stats: {e}")
            return {}
    
    def get_reporter_activity(self, reports: List[Dict], top_n: int = 5) -> List[Dict]:
        """
        Get most active reporters
        
        Args:
            reports: List of reports with reporter info
            top_n: Number of top reporters to return
        
        Returns:
            List of dicts with reporter info and report counts
        """
        try:
            reporters = {}
            for report in reports:
                reporter_id = report.get("reporter_id", "anonymous")
                reporter_name = report.get("reporter_name", "Anonymous")
                if reporter_id not in reporters:
                    reporters[reporter_id] = {"name": reporter_name, "count": 0}
                reporters[reporter_id]["count"] += 1
            
            sorted_reporters = sorted(
                reporters.items(),
                key=lambda x: x[1]["count"],
                reverse=True
            )
            
            return [
                {"id": rid, "name": data["name"], "reports": data["count"]}
                for rid, data in sorted_reporters[:top_n]
            ]
            
        except Exception as e:
            logger.error(f"Error calculating reporter activity: {e}")
            return []
    
    def generate_category_chart(self, reports: List[Dict]) -> Optional[str]:
        """
        Generate bar chart for category distribution
        
        Args:
            reports: List of reports
        
        Returns:
            Base64 encoded PNG image
        """
        try:
            dist = self.get_category_distribution(reports)
            if not dist:
                return None
            
            plt.figure(figsize=(10, 6))
            categories = list(dist.keys())
            counts = list(dist.values())
            
            plt.bar(categories, counts, color="steelblue")
            plt.title("Incident Distribution by Category")
            plt.xlabel("Category")
            plt.ylabel("Count")
            plt.xticks(rotation=45, ha="right")
            plt.tight_layout()
            
            # Convert to base64
            buffer = BytesIO()
            plt.savefig(buffer, format="png")
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return f"data:image/png;base64,{image_base64}"
            
        except Exception as e:
            logger.error(f"Error generating category chart: {e}")
            return None
    
    def generate_timeline_chart(self, reports: List[Dict]) -> Optional[str]:
        """
        Generate line chart for temporal trends
        
        Args:
            reports: List of reports with timestamps
        
        Returns:
            Base64 encoded PNG image
        """
        try:
            trends = self.get_temporal_trends(reports, period="day")
            if not trends:
                return None
            
            # Convert datetime keys to strings for sorting
            dates = sorted([pd.to_datetime(d) for d in trends.keys()])
            counts = [trends[d] for d in dates]
            
            plt.figure(figsize=(12, 6))
            plt.plot(dates, counts, marker="o", linewidth=2, color="darkgreen")
            plt.title("Incident Trends Over Time")
            plt.xlabel("Date")
            plt.ylabel("Number of Incidents")
            plt.gca().xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
            plt.xticks(rotation=45)
            plt.tight_layout()
            
            # Convert to base64
            buffer = BytesIO()
            plt.savefig(buffer, format="png")
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return f"data:image/png;base64,{image_base64}"
            
        except Exception as e:
            logger.error(f"Error generating timeline chart: {e}")
            return None
    
    def get_comprehensive_report(self, reports: List[Dict]) -> Dict[str, Any]:
        """
        Generate comprehensive analytics report
        
        Args:
            reports: List of reports
        
        Returns:
            Dict with all analytics
        """
        try:
            if not reports:
                return {"error": "No reports available"}
            
            report = {
                "total_reports": len(reports),
                "category_distribution": self.get_category_distribution(reports),
                "priority_breakdown": self.get_priority_breakdown(reports),
                "response_stats": self.get_response_stats(reports),
                "top_hotspots": self.get_hotspots(reports, top_n=5),
                "top_reporters": self.get_reporter_activity(reports, top_n=5),
                "anomalies": self.detect_anomalies(reports),
                "charts": {
                    "category_chart": self.generate_category_chart(reports),
                    "timeline_chart": self.generate_timeline_chart(reports)
                }
            }
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating comprehensive report: {e}")
            return {"error": str(e)}


# Global instance
_analytics_service = None

def get_analytics_service() -> AnalyticsService:
    """Get or create global analytics service instance"""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = AnalyticsService()
    return _analytics_service
