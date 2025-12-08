"""
Analytics Service
Provides data analysis, trend detection, risk prediction, and visualizations
using NumPy, scikit-learn, pandas, and matplotlib
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from collections import Counter, defaultdict
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.linear_model import LinearRegression
from sklearn.metrics import silhouette_score
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from io import BytesIO
import base64
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for data analysis, ML predictions, and insights"""
    
    def __init__(self):
        """Initialize analytics service with ML models"""
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.risk_model = None
        self.anomaly_detector = None
        logger.info("✓ Analytics Service initialized with ML capabilities")
    
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
    
    # ========================================
    # ENHANCED ML ANALYTICS (NumPy + scikit-learn)
    # ========================================
    
    def predict_risk_score(self, reports: List[Dict]) -> List[Dict[str, Any]]:
        """
        Predict risk scores for reports using Random Forest
        
        Args:
            reports: List of reports
        
        Returns:
            List of reports with predicted risk scores
        """
        try:
            if len(reports) < 5:
                # Not enough data for ML, use rule-based
                return self._rule_based_risk_scoring(reports)
            
            # Prepare features using numpy
            features = []
            category_map = {'Crime': 4, 'Hazard': 3, 'Concern': 2, 'Lost&Found': 1, 'Others': 1}
            status_map = {'Pending': 3, 'Ongoing': 2, 'Resolved': 1}
            
            for r in reports:
                ts = pd.to_datetime(r.get("timestamp", r.get("created_at", datetime.now())))
                hour = ts.hour if hasattr(ts, "hour") else 12
                dow = ts.weekday() if hasattr(ts, "weekday") else 0
                
                cat_score = category_map.get(r.get("category", "Others"), 1)
                status_score = status_map.get(r.get("status", "Pending"), 2)
                desc_len = min(len(str(r.get("description", ""))), 500) / 100
                
                features.append([hour, dow, cat_score, status_score, desc_len])
            
            X = np.array(features)
            X_scaled = self.scaler.fit_transform(X)
            
            # Use Isolation Forest for anomaly-based risk scoring
            self.anomaly_detector = IsolationForest(contamination=0.1, random_state=42)
            anomaly_scores = self.anomaly_detector.fit_predict(X_scaled)
            risk_scores = -self.anomaly_detector.score_samples(X_scaled)
            
            # Normalize to 0-100 scale
            risk_min, risk_max = risk_scores.min(), risk_scores.max()
            if risk_max > risk_min:
                normalized_scores = ((risk_scores - risk_min) / (risk_max - risk_min)) * 100
            else:
                normalized_scores = np.full_like(risk_scores, 50)
            
            results = []
            for i, report in enumerate(reports):
                results.append({
                    **report,
                    "risk_score": float(normalized_scores[i]),
                    "is_anomaly": bool(anomaly_scores[i] == -1),
                    "risk_level": "High" if normalized_scores[i] > 70 else "Medium" if normalized_scores[i] > 40 else "Low"
                })
            
            return sorted(results, key=lambda x: x["risk_score"], reverse=True)
            
        except Exception as e:
            logger.error(f"Error predicting risk scores: {e}")
            return self._rule_based_risk_scoring(reports)
    
    def _rule_based_risk_scoring(self, reports: List[Dict]) -> List[Dict[str, Any]]:
        """Fallback rule-based risk scoring when ML isn't possible"""
        category_weights = {'Crime': 90, 'Hazard': 75, 'Concern': 50, 'Lost&Found': 25, 'Others': 30}
        status_weights = {'Pending': 1.2, 'Ongoing': 1.0, 'Resolved': 0.5}
        
        results = []
        for report in reports:
            base_score = category_weights.get(report.get("category", "Others"), 30)
            status_mult = status_weights.get(report.get("status", "Pending"), 1.0)
            risk_score = min(100, base_score * status_mult)
            
            results.append({
                **report,
                "risk_score": risk_score,
                "is_anomaly": False,
                "risk_level": "High" if risk_score > 70 else "Medium" if risk_score > 40 else "Low"
            })
        
        return sorted(results, key=lambda x: x["risk_score"], reverse=True)
    
    def predict_trend(self, reports: List[Dict], days_ahead: int = 7) -> Dict[str, Any]:
        """
        Predict future incident trends using Linear Regression
        
        Args:
            reports: Historical reports
            days_ahead: Number of days to predict
        
        Returns:
            Dict with predictions and confidence
        """
        try:
            df = self.prepare_dataframe(reports)
            if df is None or len(df) < 7:
                return {"error": "Insufficient data for trend prediction", "predictions": []}
            
            # Aggregate by day
            if "timestamp" not in df.columns and "created_at" in df.columns:
                df["timestamp"] = pd.to_datetime(df["created_at"])
            
            df["date"] = df["timestamp"].dt.date
            daily_counts = df.groupby("date").size().reset_index(name="count")
            
            if len(daily_counts) < 3:
                return {"error": "Insufficient daily data", "predictions": []}
            
            # Prepare features for regression
            daily_counts["day_num"] = np.arange(len(daily_counts))
            X = daily_counts["day_num"].values.reshape(-1, 1)
            y = daily_counts["count"].values
            
            # Train Linear Regression model
            model = LinearRegression()
            model.fit(X, y)
            
            # Calculate R² score
            r2_score = model.score(X, y)
            
            # Predict future days
            last_day = daily_counts["day_num"].max()
            future_days = np.arange(last_day + 1, last_day + 1 + days_ahead).reshape(-1, 1)
            predictions = model.predict(future_days)
            
            # Ensure predictions are non-negative
            predictions = np.maximum(0, predictions).astype(int)
            
            # Generate prediction dates
            last_date = pd.to_datetime(daily_counts["date"].max())
            prediction_dates = [
                (last_date + timedelta(days=i+1)).strftime("%Y-%m-%d")
                for i in range(days_ahead)
            ]
            
            return {
                "model": "linear_regression",
                "r2_score": float(r2_score),
                "confidence": "High" if r2_score > 0.7 else "Medium" if r2_score > 0.4 else "Low",
                "trend_direction": "Increasing" if model.coef_[0] > 0 else "Decreasing",
                "slope": float(model.coef_[0]),
                "predictions": [
                    {"date": date, "predicted_count": int(count)}
                    for date, count in zip(prediction_dates, predictions)
                ],
                "historical_avg": float(np.mean(y)),
                "predicted_avg": float(np.mean(predictions))
            }
            
        except Exception as e:
            logger.error(f"Error predicting trend: {e}")
            return {"error": str(e), "predictions": []}
    
    def cluster_incidents(self, reports: List[Dict], n_clusters: int = None) -> Dict[str, Any]:
        """
        Cluster incidents using K-Means or DBSCAN
        
        Args:
            reports: List of reports with location data
            n_clusters: Number of clusters (auto-detect if None)
        
        Returns:
            Dict with cluster assignments and centroids
        """
        try:
            if len(reports) < 3:
                return {"error": "Insufficient data for clustering", "clusters": []}
            
            # Extract features
            features = []
            valid_reports = []
            
            for r in reports:
                lat = r.get("lat") or r.get("latitude")
                lng = r.get("lng") or r.get("longitude")
                
                if lat and lng:
                    try:
                        features.append([float(lat), float(lng)])
                        valid_reports.append(r)
                    except (ValueError, TypeError):
                        pass
            
            if len(features) < 3:
                return {"error": "Insufficient location data", "clusters": []}
            
            X = np.array(features)
            
            # Auto-detect optimal clusters using silhouette score
            if n_clusters is None:
                best_score = -1
                best_k = 2
                
                for k in range(2, min(8, len(X))):
                    try:
                        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                        labels = kmeans.fit_predict(X)
                        score = silhouette_score(X, labels)
                        if score > best_score:
                            best_score = score
                            best_k = k
                    except:
                        pass
                
                n_clusters = best_k
            
            # Final clustering
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = kmeans.fit_predict(X)
            
            # Build cluster info
            clusters = []
            for i in range(n_clusters):
                cluster_mask = labels == i
                cluster_reports = [valid_reports[j] for j in range(len(valid_reports)) if cluster_mask[j]]
                
                clusters.append({
                    "cluster_id": i,
                    "centroid": {
                        "lat": float(kmeans.cluster_centers_[i][0]),
                        "lng": float(kmeans.cluster_centers_[i][1])
                    },
                    "count": int(np.sum(cluster_mask)),
                    "reports": cluster_reports[:5],  # Top 5 reports
                    "categories": dict(Counter([r.get("category", "Others") for r in cluster_reports]))
                })
            
            return {
                "n_clusters": n_clusters,
                "silhouette_score": float(silhouette_score(X, labels)) if len(set(labels)) > 1 else 0,
                "clusters": sorted(clusters, key=lambda x: x["count"], reverse=True)
            }
            
        except Exception as e:
            logger.error(f"Error clustering incidents: {e}")
            return {"error": str(e), "clusters": []}
    
    def generate_risk_heatmap(self, reports: List[Dict]) -> Optional[str]:
        """
        Generate risk heatmap visualization using matplotlib
        
        Args:
            reports: List of reports with risk scores
        
        Returns:
            Base64 encoded PNG image
        """
        try:
            # First get risk scores
            scored_reports = self.predict_risk_score(reports)
            
            # Extract categories and their risk scores
            category_risks = defaultdict(list)
            for r in scored_reports:
                cat = r.get("category", "Others")
                category_risks[cat].append(r.get("risk_score", 50))
            
            # Calculate average risk per category
            categories = list(category_risks.keys())
            avg_risks = [np.mean(category_risks[cat]) for cat in categories]
            
            # Create heatmap-style bar chart
            fig, ax = plt.subplots(figsize=(10, 6))
            
            colors = []
            for risk in avg_risks:
                if risk > 70:
                    colors.append('#ef4444')  # Red - High
                elif risk > 40:
                    colors.append('#f59e0b')  # Orange - Medium
                else:
                    colors.append('#10b981')  # Green - Low
            
            bars = ax.barh(categories, avg_risks, color=colors)
            
            ax.set_xlabel('Average Risk Score', fontsize=12)
            ax.set_title('Risk Assessment by Category', fontsize=14, fontweight='bold')
            ax.set_xlim(0, 100)
            
            # Add value labels
            for bar, risk in zip(bars, avg_risks):
                ax.text(risk + 2, bar.get_y() + bar.get_height()/2, 
                       f'{risk:.1f}', va='center', fontsize=10)
            
            # Add legend
            from matplotlib.patches import Patch
            legend_elements = [
                Patch(facecolor='#ef4444', label='High Risk (>70)'),
                Patch(facecolor='#f59e0b', label='Medium Risk (40-70)'),
                Patch(facecolor='#10b981', label='Low Risk (<40)')
            ]
            ax.legend(handles=legend_elements, loc='lower right')
            
            plt.tight_layout()
            
            # Convert to base64
            buffer = BytesIO()
            plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return f"data:image/png;base64,{image_base64}"
            
        except Exception as e:
            logger.error(f"Error generating risk heatmap: {e}")
            return None
    
    def generate_trend_forecast_chart(self, reports: List[Dict]) -> Optional[str]:
        """
        Generate trend forecast visualization with prediction
        
        Args:
            reports: Historical reports
        
        Returns:
            Base64 encoded PNG image
        """
        try:
            prediction_result = self.predict_trend(reports, days_ahead=7)
            
            if "error" in prediction_result or not prediction_result.get("predictions"):
                return None
            
            # Prepare historical data
            df = self.prepare_dataframe(reports)
            if df is None:
                return None
            
            if "timestamp" not in df.columns and "created_at" in df.columns:
                df["timestamp"] = pd.to_datetime(df["created_at"])
            
            df["date"] = df["timestamp"].dt.date
            daily_counts = df.groupby("date").size().reset_index(name="count")
            
            # Plot
            fig, ax = plt.subplots(figsize=(12, 6))
            
            # Historical data
            hist_dates = pd.to_datetime(daily_counts["date"])
            hist_counts = daily_counts["count"].values
            
            ax.plot(hist_dates, hist_counts, 'b-', marker='o', linewidth=2, 
                   markersize=6, label='Historical', color='#2563eb')
            
            # Prediction data
            pred_dates = [pd.to_datetime(p["date"]) for p in prediction_result["predictions"]]
            pred_counts = [p["predicted_count"] for p in prediction_result["predictions"]]
            
            ax.plot(pred_dates, pred_counts, '--', marker='s', linewidth=2,
                   markersize=6, label='Forecast', color='#f59e0b')
            
            # Fill prediction area
            ax.fill_between(pred_dates, 
                           [max(0, c - 2) for c in pred_counts],
                           [c + 2 for c in pred_counts],
                           alpha=0.2, color='#f59e0b')
            
            # Styling
            ax.set_xlabel('Date', fontsize=12)
            ax.set_ylabel('Number of Incidents', fontsize=12)
            ax.set_title(f'Incident Trend Forecast (Confidence: {prediction_result["confidence"]})', 
                        fontsize=14, fontweight='bold')
            ax.legend(loc='upper left')
            ax.grid(True, alpha=0.3)
            
            # Format x-axis dates
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            plt.xticks(rotation=45)
            
            plt.tight_layout()
            
            # Convert to base64
            buffer = BytesIO()
            plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return f"data:image/png;base64,{image_base64}"
            
        except Exception as e:
            logger.error(f"Error generating trend forecast chart: {e}")
            return None

    def get_comprehensive_report(self, reports: List[Dict]) -> Dict[str, Any]:
        """
        Generate comprehensive analytics report with ML insights
        
        Args:
            reports: List of reports
        
        Returns:
            Dict with all analytics including ML predictions
        """
        try:
            if not reports:
                return {"error": "No reports available"}
            
            # Basic analytics
            report = {
                "total_reports": len(reports),
                "category_distribution": self.get_category_distribution(reports),
                "priority_breakdown": self.get_priority_breakdown(reports),
                "response_stats": self.get_response_stats(reports),
                "top_hotspots": self.get_hotspots(reports, top_n=5),
                "top_reporters": self.get_reporter_activity(reports, top_n=5),
                "anomalies": self.detect_anomalies(reports),
            }
            
            # ML-enhanced analytics
            report["ml_insights"] = {
                "risk_assessment": self.predict_risk_score(reports)[:10],  # Top 10 high-risk
                "trend_forecast": self.predict_trend(reports, days_ahead=7),
                "incident_clusters": self.cluster_incidents(reports),
            }
            
            # Visualizations
            report["charts"] = {
                "category_chart": self.generate_category_chart(reports),
                "timeline_chart": self.generate_timeline_chart(reports),
                "risk_heatmap": self.generate_risk_heatmap(reports),
                "trend_forecast_chart": self.generate_trend_forecast_chart(reports),
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
