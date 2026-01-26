import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseFrenchPaycheck, validatePaycheckData } from '@/lib/pdf/parser';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['application/pdf'];

export async function POST(request: NextRequest) {
  console.log('[UPLOAD] Starting paycheck upload request');

  try {
    // Create authenticated Supabase client
    console.log('[UPLOAD] Creating Supabase client');
    const supabase = await createClient();

    // Check authentication
    console.log('[UPLOAD] Checking authentication');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('[UPLOAD] Auth error:', authError);
      return NextResponse.json({ error: 'Authentication failed', details: authError.message }, { status: 401 });
    }

    if (!user) {
      console.error('[UPLOAD] No user found');
      return NextResponse.json({ error: 'Unauthorized - no user session' }, { status: 401 });
    }

    console.log('[UPLOAD] User authenticated:', user.id);

    // Parse form data
    console.log('[UPLOAD] Parsing form data');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const month = formData.get('month') as string | null;
    const year = formData.get('year') as string | null;

    if (!file) {
      console.error('[UPLOAD] No file in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!month || !year) {
      console.error('[UPLOAD] Missing month or year');
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 });
    }

    console.log('[UPLOAD] File received:', { name: file.name, size: file.size, type: file.type, month, year });

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      console.error('[UPLOAD] Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files are allowed.', receivedType: file.type },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.error('[UPLOAD] File too large:', file.size);
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.', receivedSize: file.size },
        { status: 400 }
      );
    }

    // Convert file to buffer
    console.log('[UPLOAD] Converting file to buffer');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[UPLOAD] Buffer created, size:', buffer.length);

    // Parse PDF
    console.log('[UPLOAD] Starting PDF parsing');
    let parsedData;
    try {
      parsedData = await parseFrenchPaycheck(buffer);
      console.log('[UPLOAD] PDF parsed successfully:', {
        netSalary: parsedData.netSalary,
        confidence: parsedData.confidence,
        hasMonth: !!parsedData.month,
        hasEmployer: !!parsedData.employer,
      });
    } catch (error) {
      console.error('[UPLOAD] PDF parsing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      console.error('[UPLOAD] Error details:', { message: errorMessage, stack: errorStack });
      return NextResponse.json(
        {
          error: 'Failed to parse PDF. Please ensure this is a valid paycheck document.',
          details: errorMessage,
        },
        { status: 400 }
      );
    }

    // Validate parsed data
    console.log('[UPLOAD] Validating parsed data');
    if (!validatePaycheckData(parsedData)) {
      console.error('[UPLOAD] Invalid paycheck data:', parsedData);
      return NextResponse.json(
        {
          error: 'Could not extract valid salary information from this PDF.',
          parsedData: {
            netSalary: parsedData.netSalary,
            confidence: parsedData.confidence,
          },
        },
        { status: 400 }
      );
    }

    // Insert record into uploaded_documents (without storing the actual PDF file)
    console.log('[UPLOAD] Saving document metadata (PDF not stored for privacy)');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: document, error: dbError } = await (supabase
      .from('uploaded_documents') as any)
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: null, // Not storing the actual file
        file_size: file.size,
        mime_type: file.type,
        document_type: 'paycheck',
        parsed_data: {
          netSalary: parsedData.netSalary,
          grossSalary: parsedData.grossSalary,
          month: parseInt(month),
          year: parseInt(year),
          parsedMonth: parsedData.month, // Keep the parsed month from PDF for reference
          employer: parsedData.employer,
          confidence: parsedData.confidence,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('[UPLOAD] Database insert error:', dbError);
      return NextResponse.json({
        error: 'Failed to save document record. The table may not exist.',
        details: dbError.message,
      }, { status: 500 });
    }

    console.log('[UPLOAD] Document metadata saved:', document.id);

    // Return success with parsed data
    const response = {
      success: true,
      document: {
        id: document.id,
        fileName: document.file_name,
        uploadDate: document.upload_date,
        month: parseInt(month),
        year: parseInt(year),
      },
      parsedData: {
        netSalary: parsedData.netSalary,
        grossSalary: parsedData.grossSalary,
        month: parseInt(month),
        year: parseInt(year),
        parsedMonth: parsedData.month,
        employer: parsedData.employer,
        confidence: parsedData.confidence,
      },
    };

    console.log('[UPLOAD] Returning success response');
    return NextResponse.json(response);
  } catch (error) {
    console.error('[UPLOAD] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[UPLOAD] Error details:', { message: errorMessage, stack: errorStack });

    return NextResponse.json(
      {
        error: 'An unexpected error occurred during upload.',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
