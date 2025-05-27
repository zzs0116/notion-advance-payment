exports.handler = async (event, context) => {
  console.log('函数被调用，HTTP方法:', event.httpMethod);
  console.log('请求头:', JSON.stringify(event.headers, null, 2));
  
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    console.log('处理OPTIONS预检请求');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }

  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    console.log('方法不允许:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('原始请求体:', event.body);
    
    // 检查请求体是否存在
    if (!event.body) {
      console.log('请求体为空');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '请求体为空' })
      };
    }

    let data;
    try {
      data = JSON.parse(event.body);
      console.log('解析后的数据:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '无效的JSON格式' })
      };
    }
    
    // 验证必需字段
    if (!data.applicantName || !data.amount || !data.date) {
      console.log('缺少必需字段:', {
        applicantName: !!data.applicantName,
        amount: !!data.amount,
        date: !!data.date
      });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少必需字段：预支人、金额或时间' })
      };
    }
    
    // 从环境变量获取配置
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    const DATABASE_ID = process.env.DATABASE_ID;
    
    console.log('环境变量检查:', {
      hasApiKey: !!NOTION_API_KEY,
      hasDbId: !!DATABASE_ID,
      apiKeyPrefix: NOTION_API_KEY ? NOTION_API_KEY.substring(0, 10) + '...' : 'undefined'
    });
    
    if (!NOTION_API_KEY || !DATABASE_ID) {
      console.error('环境变量缺失');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '服务器配置错误：缺少API密钥或数据库ID' })
      };
    }

    console.log('准备调用Notion API...');
    
    // 构建Notion API请求体
    const notionRequestBody = {
      parent: { database_id: DATABASE_ID },
      properties: {
        '预支人': {
          title: [{ text: { content: String(data.applicantName) } }]
        },
        '预支金额': {
          number: parseFloat(data.amount)
        },
        '时间': {
          date: { start: data.date }
        }
      }
    };
    
    console.log('Notion请求体:', JSON.stringify(notionRequestBody, null, 2));
    
    // 调用Notion API
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(notionRequestBody)
    });

    console.log('Notion API响应状态:', response.status);
    console.log('Notion API响应头:', JSON.stringify([...response.headers.entries()], null, 2));

    let responseText;
    try {
      responseText = await response.text();
      console.log('Notion API原始响应:', responseText);
    } catch (textError) {
      console.error('读取响应文本失败:', textError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '无法读取Notion API响应' })
      };
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
        console.error('Notion API错误:', errorData);
      } catch (e) {
        console.error('解析Notion错误响应失败:', e);
        errorData = { message: responseText };
      }
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Notion API错误 (${response.status}): ${errorData.message || response.statusText}`,
          details: errorData
        })
      };
    }

    let result;
    try {
      result = JSON.parse(responseText);
      console.log('Notion API成功响应ID:', result.id);
    } catch (parseError) {
      console.error('解析成功响应失败:', parseError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '解析Notion响应失败' })
      };
    }
    
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
    console.error('错误堆栈:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `服务器内部错误: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};