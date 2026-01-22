import { createClient } from '@vercel/kv';

const kv = createClient({
    url: process.env.KV_REST_API_URL || '',
    token: process.env.KV_REST_API_TOKEN || '',
});

/**
 * 간단한 텍스트 임베딩 유사도 계산 (키워드 기반)
 * 실제 운영 환경에서는 OpenAI Embedding API 등 사용 권장
 */
function calculateSimilarity(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    let matches = 0;
    for (const word of queryWords) {
        if (word.length > 2 && textLower.includes(word)) {
            matches++;
        }
    }
    return matches / Math.max(queryWords.length, 1);
}

/**
 * DB에서 관련 문서 검색 (RAG)
 * @param query 사용자 질문
 * @param topK 반환할 상위 문서 수 (기본값: 3)
 */
export async function searchDocuments(query: string, topK: number = 3): Promise<any[]> {
    try {
        // KV에 저장된 모든 문서 조회
        const keys = await kv.keys('doc:*');
        
        if (!keys || keys.length === 0) {
            console.log('[RAG] No documents found in database');
            return [];
        }

        // 각 문서 조회 및 유사도 계산
        const documents = [];
        for (const key of keys) {
            try {
                const docContent = await kv.get(key as string);
                if (docContent) {
                    const similarity = calculateSimilarity(query, String(docContent));
                    if (similarity > 0) {
                        documents.push({
                            id: key,
                            content: String(docContent).substring(0, 500), // 길이 제한
                            similarity,
                        });
                    }
                }
            } catch (error) {
                console.error(`Error fetching document ${key}:`, error);
            }
        }

        // 유사도 순으로 정렬 후 상위 K개 반환
        return documents
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    } catch (error) {
        console.error('[RAG] Search error:', error);
        return [];
    }
}

/**
 * 문서 업로드/저장 (관리자용)
 */
export async function saveDocument(documentId: string, content: string): Promise<boolean> {
    try {
        await kv.set(`doc:${documentId}`, content);
        console.log(`[RAG] Document saved: ${documentId}`);
        return true;
    } catch (error) {
        console.error('[RAG] Save error:', error);
        return false;
    }
}

/**
 * 저장된 모든 문서 조회
 */
export async function getAllDocuments(): Promise<any[]> {
    try {
        const keys = await kv.keys('doc:*');
        if (!keys || keys.length === 0) return [];

        const documents = [];
        for (const key of keys) {
            const content = await kv.get(key as string);
            if (content) {
                documents.push({
                    id: key,
                    content: String(content),
                });
            }
        }
        return documents;
    } catch (error) {
        console.error('[RAG] Fetch all error:', error);
        return [];
    }
}

/**
 * 문서 삭제
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
    try {
        await kv.del(`doc:${documentId}`);
        console.log(`[RAG] Document deleted: ${documentId}`);
        return true;
    } catch (error) {
        console.error('[RAG] Delete error:', error);
        return false;
    }
}
