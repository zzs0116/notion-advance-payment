exports.handler = async (event, context) => {
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    
    // 验证必需字段
    if (!data.applicantName || !data.amount || !data.date) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少必需字段' })
      };
    }
    
    // 从环境变量获取配置
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const DATABASE_ID = process.env.DATABASE_ID;
    
    if (!NOTION_API_KEY || !DATABASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '服务器配置错误：缺少API密钥或数据库ID' })
      };
    }

    console.log('准备提交到Notion:', {
      applicantName: data.applicantName,
      amount: data.amount,
      date: data.date
    });
    
    // 调用Notion API
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties: {
          '预支人': {
            title: [{ text: { content: data.applicantName } }]
          },
          '预支金额': {
            number: parseFloat(data.amount)
          },
          '时间': {
            date: { start: data.date }
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Notion API错误:', errorData);
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Notion API错误: ${errorData.message || response.statusText}`,
          details: errorData
        })
      };
    }

    const result = await response.json();
    console.log('Notion API成功响应:', result.id);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: '数据已成功提交到Notion',
        pageId: result.id
      })
    };
    
  } catch (error) {
    console.error('函数执行错误:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `服务器错误: ${error.message}` 
      })
    };
  }
};