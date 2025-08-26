/**
 * TrendGraph Web Component - Isolated trend visualization for tab keeper data
 * Displays daily maze solved, tab limit, and tabs blocked trends
 */

class TrendGraph extends HTMLElement {
  static get observedAttributes() {
    return ['data-period', 'data-granularity'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Component state
    this.period = 'current-month';
    this.granularity = 'daily';
    this.data = {
      dailyMazes: {},
      dailyTabLimits: {},
      dailyBlockedAttempts: {}
    };
    
    // Chart dimensions and styling
    this.dimensions = {
      width: 800,
      height: 300,
      margin: { top: 20, right: 80, bottom: 60, left: 60 }
    };
    
    this.colors = {
      mazes: '#4ecdc4',      // Teal - matches maze goal color
      tabLimit: '#ff6b6b',   // Red - matches maze player color  
      blocked: '#ffd93d',    // Yellow - warning/blocked color
      grid: '#e5e5e5',
      text: '#666666',
      background: '#ffffff'
    };
    
    this.render();
    this.setupEventListeners();
  }

  connectedCallback() {
    this.updateChart();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'data-period') {
        this.period = newValue;
        this.updateChart();
      } else if (name === 'data-granularity') {
        this.granularity = newValue;
        this.updateChart();
      }
    }
  }

  // Method to update data from parent component
  setData(newData) {
    if (newData) {
      this.data = {
        dailyMazes: newData.dailyMazes || {},
        dailyTabLimits: newData.dailyTabLimits || {},
        dailyBlockedAttempts: newData.dailyBlockedAttempts || {}
      };
      this.updateChart();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .trend-graph-container {
          background: ${this.colors.background};
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin: 16px 0;
        }

        .graph-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .graph-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .graph-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          gap: 4px;
        }

        .control-group label {
          font-size: 12px;
          color: ${this.colors.text};
          margin-right: 8px;
          font-weight: 500;
        }

        .control-btn {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: ${this.colors.text};
        }

        .control-btn:hover {
          background: #f5f5f5;
          border-color: #ccc;
        }

        .control-btn.active {
          background: #4ecdc4;
          color: white;
          border-color: #4ecdc4;
        }

        .chart-container {
          position: relative;
          width: 100%;
          height: 300px;
          overflow: hidden;
        }

        .tooltip {
          position: absolute;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
          z-index: 1000;
          white-space: pre-line;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .tooltip.visible {
          opacity: 1;
        }

        .chart-svg {
          width: 100%;
          height: 100%;
        }

        .legend {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: ${this.colors.text};
        }

        .legend-color {
          width: 16px;
          height: 3px;
          border-radius: 2px;
        }

        .no-data-message {
          text-align: center;
          padding: 40px 20px;
          color: ${this.colors.text};
          font-style: italic;
        }

        .loading {
          text-align: center;
          padding: 40px 20px;
          color: ${this.colors.text};
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .graph-header {
            flex-direction: column;
            align-items: stretch;
          }
          
          .graph-controls {
            justify-content: center;
          }
          
          .control-group {
            flex-wrap: wrap;
            justify-content: center;
          }
          
          .legend {
            gap: 16px;
          }
        }
      </style>
      
      <div class="trend-graph-container">
        <div class="graph-header">
          <h3 class="graph-title">
            <span>📈</span>
            ${chrome.i18n.getMessage('usageTrends')}
          </h3>
          
          <div class="graph-controls">
            <div class="control-group">
              <label>${chrome.i18n.getMessage('period')}</label>
              <button class="control-btn period-btn active" data-period="current-month">${chrome.i18n.getMessage('thisMonth')}</button>
              <button class="control-btn period-btn" data-period="last-30-days">${chrome.i18n.getMessage('last30Days')}</button>
              <button class="control-btn period-btn" data-period="last-90-days">${chrome.i18n.getMessage('last90Days')}</button>
            </div>
            
            <div class="control-group">
              <label>${chrome.i18n.getMessage('view')}</label>
              <button class="control-btn granularity-btn active" data-granularity="daily">${chrome.i18n.getMessage('daily')}</button>
              <button class="control-btn granularity-btn" data-granularity="weekly">${chrome.i18n.getMessage('weekly')}</button>
              <button class="control-btn granularity-btn" data-granularity="monthly">${chrome.i18n.getMessage('monthly')}</button>
            </div>
          </div>
        </div>

        <div class="chart-container">
          <div class="loading">${chrome.i18n.getMessage('loadingTrendData') || 'Loading trend data...'}</div>
          <div class="tooltip"></div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <div class="legend-color" style="background-color: ${this.colors.mazes}"></div>
            <span>${chrome.i18n.getMessage('mazesSolved')}</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: ${this.colors.tabLimit}"></div>
            <span>${chrome.i18n.getMessage('tabLimitHeading')}</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: ${this.colors.blocked}"></div>
            <span>${chrome.i18n.getMessage('tabsBlocked')}</span>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Period controls
    this.shadowRoot.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.shadowRoot.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.period = e.target.dataset.period;
        this.updateChart();
      });
    });

    // Granularity controls  
    this.shadowRoot.querySelectorAll('.granularity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.shadowRoot.querySelectorAll('.granularity-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.granularity = e.target.dataset.granularity;
        this.updateChart();
      });
    });
  }


  updateChart() {
    const chartContainer = this.shadowRoot.querySelector('.chart-container');
    
    // Generate date range for current period
    const dateRange = this.getDateRange();
    const aggregatedData = this.aggregateData(dateRange);
    
    if (aggregatedData.length === 0) {
      this.showNoData();
      return;
    }

    // Create SVG chart
    const svg = this.createSVGChart(aggregatedData);
    
    // Preserve tooltip and only clear other content
    const tooltip = chartContainer.querySelector('.tooltip');
    chartContainer.innerHTML = '';
    chartContainer.appendChild(svg);
    if (tooltip) {
      chartContainer.appendChild(tooltip);
    }
  }

  getDateRange() {
    const now = new Date();
    const dates = [];

    if (this.period === 'current-month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
    } else if (this.period === 'last-30-days') {
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        dates.push(date);
      }
    } else if (this.period === 'last-90-days') {
      for (let i = 89; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        dates.push(date);
      }
    }

    return dates;
  }

  aggregateData(dateRange) {
    const data = [];

    if (this.granularity === 'daily') {
      dateRange.forEach(date => {
        const dateKey = this.formatDateKey(date);
        data.push({
          date: date,
          dateKey: dateKey,
          mazes: this.data.dailyMazes[dateKey] || 0,
          tabLimit: this.data.dailyTabLimits[dateKey] || 0, // Default tab limit
          blocked: this.data.dailyBlockedAttempts[dateKey] || 0
        });
      });
    } else if (this.granularity === 'weekly') {
      // Group by weeks
      const weeks = this.groupByWeek(dateRange);
      weeks.forEach(week => {
        const weekData = {
          date: week.startDate,
          dateKey: `${week.year}-W${week.week}`,
          mazes: 0,
          tabLimit: 0,
          blocked: 0,
          count: 0
        };
        
        week.dates.forEach(date => {
          const dateKey = this.formatDateKey(date);
          weekData.mazes += this.data.dailyMazes[dateKey] || 0;
          weekData.blocked += this.data.dailyBlockedAttempts[dateKey] || 0;
          if (this.data.dailyTabLimits[dateKey]) {
            weekData.tabLimit += this.data.dailyTabLimits[dateKey];
            weekData.count++;
          }
        });
        
        // Average tab limit for the week
        weekData.tabLimit = weekData.count > 0 ? Math.round(weekData.tabLimit / weekData.count) : 0;
        data.push(weekData);
      });
    } else if (this.granularity === 'monthly') {
      // Group by months
      const months = this.groupByMonth(dateRange);
      months.forEach(month => {
        const monthData = {
          date: month.startDate,
          dateKey: `${month.year}-${String(month.month).padStart(2, '0')}`,
          mazes: 0,
          tabLimit: 0,
          blocked: 0,
          count: 0
        };
        
        month.dates.forEach(date => {
          const dateKey = this.formatDateKey(date);
          monthData.mazes += this.data.dailyMazes[dateKey] || 0;
          monthData.blocked += this.data.dailyBlockedAttempts[dateKey] || 0;
          if (this.data.dailyTabLimits[dateKey]) {
            monthData.tabLimit += this.data.dailyTabLimits[dateKey];
            monthData.count++;
          }
        });
        
        // Average tab limit for the month
        monthData.tabLimit = monthData.count > 0 ? Math.round(monthData.tabLimit / monthData.count) : 0;
        data.push(monthData);
      });
    }

    return data;
  }

  formatDateKey(date) {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
  }

  groupByWeek(dates) {
    const weeks = new Map();
    
    dates.forEach(date => {
      const year = date.getFullYear();
      const week = this.getWeekNumber(date);
      const key = `${year}-${week}`;
      
      if (!weeks.has(key)) {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        
        weeks.set(key, {
          year,
          week,
          startDate: startOfWeek,
          dates: []
        });
      }
      
      weeks.get(key).dates.push(date);
    });
    
    return Array.from(weeks.values()).sort((a, b) => a.startDate - b.startDate);
  }

  groupByMonth(dates) {
    const months = new Map();
    
    dates.forEach(date => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      
      if (!months.has(key)) {
        months.set(key, {
          year,
          month,
          startDate: new Date(year, month - 1, 1),
          dates: []
        });
      }
      
      months.get(key).dates.push(date);
    });
    
    return Array.from(months.values()).sort((a, b) => a.startDate - b.startDate);
  }

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  createSVGChart(data) {
    const { width, height, margin } = this.dimensions;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'chart-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Find max values for scaling
    const maxMazes = Math.max(...data.map(d => d.mazes), 1);
    const maxTabLimit = Math.max(...data.map(d => d.tabLimit), 1);
    const maxBlocked = Math.max(...data.map(d => d.blocked), 1);
    const overallMax = Math.max(maxMazes, maxTabLimit, maxBlocked);

    // Create scales
    const xScale = (i) => margin.left + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
    const yScale = (value) => margin.top + chartHeight - (value / overallMax) * chartHeight;

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', width);
    bg.setAttribute('height', height);
    bg.setAttribute('fill', this.colors.background);
    svg.appendChild(bg);

    // Grid lines
    this.addGridLines(svg, chartWidth, chartHeight, margin, overallMax);

    // Draw lines
    this.drawLine(svg, data, xScale, yScale, 'mazes', this.colors.mazes);
    this.drawLine(svg, data, xScale, yScale, 'tabLimit', this.colors.tabLimit);
    this.drawLine(svg, data, xScale, yScale, 'blocked', this.colors.blocked);

    // Draw points
    this.drawPoints(svg, data, xScale, yScale, 'mazes', this.colors.mazes);
    this.drawPoints(svg, data, xScale, yScale, 'tabLimit', this.colors.tabLimit);
    this.drawPoints(svg, data, xScale, yScale, 'blocked', this.colors.blocked);

    // Add axes
    this.addAxes(svg, data, chartWidth, chartHeight, margin, overallMax);

    return svg;
  }

  addGridLines(svg, chartWidth, chartHeight, margin, maxValue) {
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * chartHeight;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', margin.left);
      line.setAttribute('y1', y);
      line.setAttribute('x2', margin.left + chartWidth);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', this.colors.grid);
      line.setAttribute('stroke-width', '1');
      gridGroup.appendChild(line);
    }
    
    svg.appendChild(gridGroup);
  }

  drawLine(svg, data, xScale, yScale, property, color) {
    if (data.length < 2) return;
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData = `M ${xScale(0)} ${yScale(data[0][property])}`;
    
    for (let i = 1; i < data.length; i++) {
      pathData += ` L ${xScale(i)} ${yScale(data[i][property])}`;
    }
    
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    svg.appendChild(path);
  }

  drawPoints(svg, data, xScale, yScale, property, color) {
    const tooltip = this.shadowRoot.querySelector('.tooltip');
    
    data.forEach((point, i) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', xScale(i));
      circle.setAttribute('cy', yScale(point[property]));
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', color);
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '1');
      
      // Make points interactive with HTML tooltip
      circle.addEventListener('mouseenter', (e) => {
        circle.setAttribute('r', '5');
        circle.setAttribute('stroke-width', '2');
        
        // Show tooltip
        const propertyLabels = {
          'mazes': 'Mazes Solved',
          'tabLimit': 'Tab Limit', 
          'blocked': 'Tabs Blocked'
        };
        const currentLabel = propertyLabels[property];
        tooltip.innerHTML = `${this.formatDate(point.date)}<br/>${currentLabel}: ${point[property]}<br/>Mazes: ${point.mazes} | Tab Limit: ${point.tabLimit} | Blocked: ${point.blocked}`;
        tooltip.classList.add('visible');
        
        // Smart tooltip positioning to avoid boundary clipping
        const cx = parseFloat(circle.getAttribute('cx'));
        const cy = parseFloat(circle.getAttribute('cy'));
        const containerRect = this.shadowRoot.querySelector('.chart-container');
        const containerWidth = containerRect.offsetWidth;
        const containerHeight = containerRect.offsetHeight;
        
        // Calculate tooltip dimensions (approximate)
        const tooltipWidth = 200; // estimated width
        const tooltipHeight = 60; // estimated height
        
        // Smart horizontal positioning with safety margins
        let left = cx + 10;
        if (left + tooltipWidth > containerWidth - 20) { // Add 20px safety margin
          left = cx - tooltipWidth - 10; // Place to the left of point
        }
        // Ensure tooltip doesn't go off left edge when positioned to the left
        if (left < 10) { // Minimum left margin
          left = 10;
        }
        // Final check to ensure it doesn't exceed right boundary
        if (left + tooltipWidth > containerWidth - 10) {
          left = containerWidth - tooltipWidth - 10;
        }
        
        // Smart vertical positioning  
        let top = cy - tooltipHeight - 10;
        if (top < 0) {
          top = cy + 15; // Place below point if not enough space above
        }
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      });
      
      circle.addEventListener('mousemove', (e) => {
        if (tooltip.classList.contains('visible')) {
          // Update positioning on mouse move using same smart logic
          const cx = parseFloat(circle.getAttribute('cx'));
          const cy = parseFloat(circle.getAttribute('cy'));
          const containerRect = this.shadowRoot.querySelector('.chart-container');
          const containerWidth = containerRect.offsetWidth;
          
          const tooltipWidth = 200;
          const tooltipHeight = 60;
          
          let left = cx + 10;
          if (left + tooltipWidth > containerWidth - 20) { // Add 20px safety margin
            left = cx - tooltipWidth - 10;
          }
          // Ensure tooltip doesn't go off left edge when positioned to the left
          if (left < 10) {
            left = 10;
          }
          // Final check to ensure it doesn't exceed right boundary
          if (left + tooltipWidth > containerWidth - 10) {
            left = containerWidth - tooltipWidth - 10;
          }
          
          let top = cy - tooltipHeight - 10;
          if (top < 0) {
            top = cy + 15;
          }
          
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
        }
      });
      
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', '3');
        circle.setAttribute('stroke-width', '1');
        tooltip.classList.remove('visible');
      });
      
      svg.appendChild(circle);
    });
  }

  addAxes(svg, data, chartWidth, chartHeight, margin, maxValue) {
    // Y-axis
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', margin.left);
    yAxis.setAttribute('y1', margin.top);
    yAxis.setAttribute('x2', margin.left);
    yAxis.setAttribute('y2', margin.top + chartHeight);
    yAxis.setAttribute('stroke', this.colors.text);
    yAxis.setAttribute('stroke-width', '1');
    svg.appendChild(yAxis);

    // X-axis
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', margin.left);
    xAxis.setAttribute('y1', margin.top + chartHeight);
    xAxis.setAttribute('x2', margin.left + chartWidth);
    xAxis.setAttribute('y2', margin.top + chartHeight);
    xAxis.setAttribute('stroke', this.colors.text);
    xAxis.setAttribute('stroke-width', '1');
    svg.appendChild(xAxis);

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue * (5 - i)) / 5);
      const y = margin.top + (i / 5) * chartHeight;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', margin.left - 10);
      text.setAttribute('y', y + 4);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', this.colors.text);
      text.textContent = value;
      svg.appendChild(text);
    }

    // X-axis labels (show every few points to avoid crowding)
    const labelInterval = Math.max(1, Math.floor(data.length / 6));
    data.forEach((point, i) => {
      if (i % labelInterval === 0 || i === data.length - 1) {
        const x = data.length > 1 ? margin.left + (i / (data.length - 1)) * chartWidth : margin.left + chartWidth / 2;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', margin.top + chartHeight + 20);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', this.colors.text);
        text.textContent = this.formatAxisDate(point.date);
        svg.appendChild(text);
      }
    });
  }

  formatDate(date) {
    return date.toLocaleDateString();
  }

  formatAxisDate(date) {
    if (this.granularity === 'daily') {
      return (date.getMonth() + 1) + '/' + date.getDate();
    } else if (this.granularity === 'weekly') {
      return 'W' + this.getWeekNumber(date);
    } else {
      return date.toLocaleDateString(undefined, { month: 'short' });
    }
  }

  showNoData() {
    const chartContainer = this.shadowRoot.querySelector('.chart-container');
    chartContainer.innerHTML = '<div class="no-data-message">No data available for the selected period</div>';
  }

  showError(message) {
    const chartContainer = this.shadowRoot.querySelector('.chart-container');
    chartContainer.innerHTML = `<div class="no-data-message">Error: ${message}</div>`;
  }
}

// Register the custom element
customElements.define('trend-graph', TrendGraph);

export { TrendGraph };