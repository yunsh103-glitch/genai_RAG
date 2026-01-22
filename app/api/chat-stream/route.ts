import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { getSystemPrompt } from '@/lib/prompts';
import { getSettings } from '@/lib/settings';
import { searchDocuments } from '@/lib/rag';

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 사용자의 최신 질문 가져오기
        const userMessage = messages[messages.length - 1]?.content || '';

        // 설정 가져오기
        const settings = await getSettings();
        const systemPrompt = await getSystemPrompt();

        // ✅ DB에서 관련 문서 검색 (RAG)
        let contextFromDB = '';
        try {
            const searchResults = await searchDocuments(userMessage);
            if (searchResults.length > 0) {
                contextFromDB = '\n\n## 참고 문서:\n' + 
                    searchResults
                        .map((doc: any) => `- ${doc.content}`)
                        .join('\n');
            }
        } catch (error) {
            console.error('DB search error:', error);
        }

        // 시스템 프롬프트에 DB 정보 추가
        const enhancedSystemPrompt = systemPrompt + contextFromDB;

        const result = streamText({
            model: google(settings.model),
            system: enhancedSystemPrompt,
            messages,
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error('Chat API error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to generate response' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
