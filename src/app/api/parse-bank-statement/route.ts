import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseBankStatement } from '@/lib/pdf/bank-statement-parser';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf'];

export async function POST(request: NextRequest) {
  console.log('[BANK-STATEMENT] Starting parse request');

  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[BANK-STATEMENT] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[BANK-STATEMENT] User authenticated:', user.id);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('[BANK-STATEMENT] File received:', { name: file.name, size: file.size, type: file.type });

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    console.log('[BANK-STATEMENT] Starting PDF parsing');
    let parsedData;
    try {
      parsedData = await parseBankStatement(buffer);
      console.log('[BANK-STATEMENT] PDF parsed successfully:', {
        transactionCount: parsedData.transactions.length,
        confidence: parsedData.confidence,
      });
    } catch (error) {
      console.error('[BANK-STATEMENT] PDF parsing error:', error);
      return NextResponse.json(
        {
          error: 'Failed to parse PDF. Please ensure this is a valid bank statement.',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    // Return parsed data (without storing the file)
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      ...parsedData,
    });
  } catch (error) {
    console.error('[BANK-STATEMENT] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
